import type { Meta, StoryObj } from "@storybook/react";
import { Provider } from "react-redux";
import { store } from "../src/store";
import { UserProfile } from "../src/components/UserProfile";

const meta: Meta<typeof UserProfile> = {
  component: UserProfile,
  decorators: [
    (Story) => (
      <Provider store={store}>
        <Story />
      </Provider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof UserProfile>;

export const Default: Story = {
  args: { userId: "1" },
};
