// This file mimics the shape of `@rtk-query/codegen-openapi` output (injected onto the
// hand-written `baseApi`), rather than being produced by actually running the codegen
// tool. See DECISIONS.md.
import { baseApi as api } from "./baseApi";
import type { Post, User } from "../types";

const addTagTypes = ["User", "Post"] as const;

const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getUsers: build.query<GetUsersApiResponse, GetUsersApiArg>({
        query: () => ({ url: `/users` }),
        providesTags: ["User"],
      }),
      getPost: build.query<GetPostApiResponse, GetPostApiArg>({
        query: (queryArg) => ({ url: `/posts/${queryArg.postId}` }),
        providesTags: ["Post"],
      }),
      createPost: build.mutation<CreatePostApiResponse, CreatePostApiArg>({
        query: (queryArg) => ({
          url: `/posts`,
          method: "POST",
          body: queryArg.postBody,
        }),
        invalidatesTags: ["Post"],
      }),
    }),
    overrideExisting: false,
  });

export { injectedRtkApi as generatedApi };

export type GetUsersApiResponse = /** status 200 OK */ { users: User[] };
export type GetUsersApiArg = void;

export type GetPostApiResponse = /** status 200 OK */ { post: Post };
export type GetPostApiArg = { postId: string };

export type CreatePostApiResponse = /** status 201 Created */ { post: Post };
export type CreatePostApiArg = { postBody: Pick<Post, "title" | "body"> };

export const { useGetUsersQuery, useGetPostQuery, useCreatePostMutation } = injectedRtkApi;
