export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Post {
  id: string;
  title: string;
  body: string;
  published: boolean;
}
