import { HasPatchworkMetadata } from "@/patchwork/schema";

export type DataGridDoc = HasPatchworkMetadata<never, never> & {
  title: string; // The title of the table
  data: any[][]; // The data for the table
};
