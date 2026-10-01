import type { Meta, StoryObj } from "@storybook/react";
import { Provider } from "react-redux";
import { store } from "../src/store";
import { PostList } from "../src/components/PostList";

const meta: Meta<typeof PostList> = {
  component: PostList,
  decorators: [
    (Story) => (
      <Provider store={store}>
        <Story />
      </Provider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof PostList>;

export const Default: Story = {};
