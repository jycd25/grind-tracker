export interface ItemRow {
  id: number;
  label: string;
  first_date: string;
}

export interface ReviewRow {
  id: number;
  item_id: number;
  due_date: string;
  step: number;
  done_at: string | null;
}

export interface ItemWithReviews extends ItemRow {
  reviews: ReviewRow[];
}
