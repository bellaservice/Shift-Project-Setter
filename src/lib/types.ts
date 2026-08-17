export type Worker = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  personal_number: string | null;
  account_number: string | null;
  emergency_contact: string | null;
  profile_picture_url: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  address: string;
  client_name: string | null;
  client_phone: string | null;
  description: string | null;
  created_at: string;
};

export type ProjectService = {
  id: string;
  project_id: string;
  service_name: string;
  price: number | null;
};

export type Shift = {
  id: string;
  project_id: string;
  worker_id: string;
  shift_date: string;
  hours: number;
  created_at: string;
};

export type HomeStats = {
  totalHoursLogged: number;
  activeProjectCount: number;
  totalWorkerCount: number;
};

export type OngoingProject = {
  id: string;
  address: string;
  serviceNames: string[];
  totalHours: number;
};

export type RecentShiftRow = {
  id: string;
  shift_date: string;
  hours: number;
  worker_id: string;
  workerName: string;
};

export type ProjectWithDetails = Project & {
  services: ProjectService[];
  workerIds: string[];
};
