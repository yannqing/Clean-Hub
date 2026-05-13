export type BranchStatus = "active" | "disabled";

export type BranchSummary = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  status: BranchStatus;
};
