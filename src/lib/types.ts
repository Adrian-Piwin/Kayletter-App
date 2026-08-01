export type Profile = {
  clerk_user_id: string;
  email: string;
  is_premium: boolean;
  stripe_customer_id: string | null;
  legacy_firebase_uid: string | null;
};

export type Letter = {
  id: string;
  owner_clerk_id: string | null;
  share_token: string;
  legacy_display_id: string | null;
  title: string;
  pet_name: string;
  claim_email: string | null;
  created_at: string;
};

export type Note = {
  id: string;
  letter_id: string;
  content: string;
  position: number;
  created_at: string;
  read_at: string | null;
  is_favorite: boolean;
};

export type Pet = {
  letter_id: string;
  happiness: number;
  hunger: number;
  last_fed_at: string | null;
  last_played_at: string | null;
  tricks_unlocked: number;
  updated_at: string;
};
