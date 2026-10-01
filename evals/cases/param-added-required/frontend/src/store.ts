import { configureStore } from "@reduxjs/toolkit";
import { baseApi } from "./api/baseApi";
// generatedApi injects its endpoints onto baseApi's own reducer/middleware, so it doesn't
// need to be registered separately here.
import "./api/generatedApi";

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
