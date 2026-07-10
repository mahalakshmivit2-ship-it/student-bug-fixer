
-- Enums
CREATE TYPE public.app_role AS ENUM ('student', 'team_leader', 'faculty');
CREATE TYPE public.bug_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.bug_severity AS ENUM ('minor', 'major', 'blocker');
CREATE TYPE public.bug_status AS ENUM ('new', 'assigned', 'in_progress', 'testing', 'fixed', 'closed', 'reopened');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  primary_role public.app_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by any signed-in user" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles (RBAC)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- Auto-create profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _role public.app_role;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student');
  INSERT INTO public.profiles (id, full_name, avatar_url, primary_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    _role
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  modules TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Project members
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Security definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.owner_id = _user_id
    UNION
    SELECT 1 FROM public.project_members m WHERE m.project_id = _project_id AND m.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_owner(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND owner_id = _user_id);
$$;

-- Projects policies
CREATE POLICY "Members and faculty can view projects" ON public.projects FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_project_member(id, auth.uid())
  OR public.has_role(auth.uid(), 'faculty')
);
CREATE POLICY "Signed-in users can create projects" ON public.projects FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner can update project" ON public.projects FOR UPDATE TO authenticated
USING (owner_id = auth.uid());
CREATE POLICY "Owner can delete project" ON public.projects FOR DELETE TO authenticated
USING (owner_id = auth.uid());

-- Members policies
CREATE POLICY "Members can view membership" ON public.project_members FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_project_owner(project_id, auth.uid())
  OR public.is_project_member(project_id, auth.uid())
  OR public.has_role(auth.uid(), 'faculty')
);
CREATE POLICY "Owner manages members" ON public.project_members FOR ALL TO authenticated
USING (public.is_project_owner(project_id, auth.uid()))
WITH CHECK (public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "Users can join self if owner adds" ON public.project_members FOR INSERT TO authenticated
WITH CHECK (public.is_project_owner(project_id, auth.uid()) OR user_id = auth.uid());

-- Bugs
CREATE TABLE public.bugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE DEFAULT ('BUG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  module TEXT,
  priority public.bug_priority NOT NULL DEFAULT 'medium',
  severity public.bug_severity NOT NULL DEFAULT 'major',
  status public.bug_status NOT NULL DEFAULT 'new',
  due_date DATE,
  screenshot_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bugs TO authenticated;
GRANT ALL ON public.bugs TO service_role;
ALTER TABLE public.bugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members and faculty can view bugs" ON public.bugs FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()) OR public.has_role(auth.uid(), 'faculty'));
CREATE POLICY "Members can create bugs" ON public.bugs FOR INSERT TO authenticated
WITH CHECK (public.is_project_member(project_id, auth.uid()) AND reporter_id = auth.uid());
CREATE POLICY "Reporter, assignee, or owner can update bug" ON public.bugs FOR UPDATE TO authenticated
USING (
  reporter_id = auth.uid()
  OR assignee_id = auth.uid()
  OR public.is_project_owner(project_id, auth.uid())
);
CREATE POLICY "Reporter or owner can delete bug" ON public.bugs FOR DELETE TO authenticated
USING (reporter_id = auth.uid() OR public.is_project_owner(project_id, auth.uid()));

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id UUID NOT NULL REFERENCES public.bugs(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_bug(_bug_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bugs b
    WHERE b.id = _bug_id
      AND (public.is_project_member(b.project_id, _user_id) OR public.has_role(_user_id, 'faculty'))
  );
$$;

CREATE POLICY "Viewers of bug can view comments" ON public.comments FOR SELECT TO authenticated
USING (public.can_view_bug(bug_id, auth.uid()));
CREATE POLICY "Members can add comments" ON public.comments FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND public.can_view_bug(bug_id, auth.uid()));
CREATE POLICY "Author can delete own comment" ON public.comments FOR DELETE TO authenticated
USING (author_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER touch_projects BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER touch_bugs BEFORE UPDATE ON public.bugs FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER touch_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Auto-add owner as project member
CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'team_leader')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_project_created AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

-- Indexes
CREATE INDEX bugs_project_idx ON public.bugs(project_id);
CREATE INDEX bugs_status_idx ON public.bugs(status);
CREATE INDEX bugs_assignee_idx ON public.bugs(assignee_id);
CREATE INDEX comments_bug_idx ON public.comments(bug_id);
CREATE INDEX project_members_user_idx ON public.project_members(user_id);
