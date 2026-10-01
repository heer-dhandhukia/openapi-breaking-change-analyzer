import type { Meta, StoryObj } from "@storybook/react";
import { UserCard } from "../src/components/UserCard";

const meta: Meta<typeof UserCard> = {
  component: UserCard,
};

export default meta;

type Story = StoryObj<typeof UserCard>;

export const Default: Story = {
  args: {
    user: { id: "1", name: "Ada Lovelace", email: "ada@example.com", role: "admin" },
  },
};
