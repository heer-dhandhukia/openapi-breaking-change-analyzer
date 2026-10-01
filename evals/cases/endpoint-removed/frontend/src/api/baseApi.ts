import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Post, User } from "../types";

export const baseApi = createApi({
  reducerPath: "baseApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  tagTypes: ["User", "Post"],
  endpoints: (builder) => ({
    getUser: builder.query<{ user: User }, string>({
      query: (id) => `/users/${id}`,
      providesTags: ["User"],
    }),
    updateUser: builder.mutation<{ user: User }, { id: string; patch: Partial<User> }>({
      query: ({ id, patch }) => ({
        url: `/users/${id}`,
        method: "PATCH",
        body: patch,
      }),
      invalidatesTags: ["User"],
    }),
    listPosts: builder.query<Post[], void>({
      query: () => "/posts",
      providesTags: ["Post"],
    }),
  }),
});

export const { useGetUserQuery, useUpdateUserMutation, useListPostsQuery } = baseApi;
