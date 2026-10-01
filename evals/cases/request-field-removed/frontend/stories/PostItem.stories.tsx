import type { Meta, StoryObj } from "@storybook/react";
import { PostItem } from "../src/components/PostItem";

const meta: Meta<typeof PostItem> = {
  component: PostItem,
};

export default meta;

type Story = StoryObj<typeof PostItem>;

export const Default: Story = {
  args: {
    title: "Hello world",
    body: "First post body.",
  },
};
