export type InquiryStatus = "PENDING" | "ANSWERED";

export interface InquiryItem {
  id: string;
  userId: string;
  title: string;
  content: string;
  status: InquiryStatus;
  answer: string | null;
  answeredBy: string | null;
  answeredAt: string | null;
  readByUser: boolean;
  createdAt: string;
  user?: { displayName: string | null; studentNumber: string | null; email: string | null };
  answerer?: { displayName: string | null; email: string | null } | null;
}
