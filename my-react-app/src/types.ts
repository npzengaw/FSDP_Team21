export interface Task {
  id: string;
  name: string;
  description: string;
  estimation: string;
  type: string;
  people: string[];
  priority: string;
}

export interface Column {
  id: string;
  title: string;
  tasks: Task[];
}
