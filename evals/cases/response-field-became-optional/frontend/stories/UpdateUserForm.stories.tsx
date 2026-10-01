import type { Meta, StoryObj } from "@storybook/react";
import { Provider } from "react-redux";
import { store } from "../src/store";
import { UpdateUserForm } from "../src/components/UpdateUserForm";

const meta: Meta<typeof UpdateUserForm> = {
  component: UpdateUserForm,
  decorators: [
    (Story) => (
      <Provider store={store}>
        <Story />
      </Provider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof UpdateUserForm>;

export const Default: Story = {
  args: { userId: "1" },
};
