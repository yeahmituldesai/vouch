export type Idea = {
  id: string; imageUrl: string | null; name: string; category: 'Snacks' | 'Skincare' | 'Clothing' | 'Apps'; description: string;
  pricePaise: number | null; goal: number; status: 'live' | 'funded' | 'failed' | 'removed'; deadline: string; daysLeft: number; createdAt: string;
  owner: { id: string; name: string; handle: string };
  stats: { vouches: number; preorders: number; comments: number; buyers: number };
  percent: number;
  demand: { score: number; verdict: 'strong' | 'growing' | 'early'; interest: number; pay: number; conv: number };
  viewer: { vouched: boolean; followingOwner: boolean; wanted: boolean };
};
export type User = { id: string; name: string; handle: string; bio: string; avatarUrl: string | null };
export type Notice = { id: string; type: string; title: string; body: string; data: { ideaId?: string }; read: boolean; createdAt: string };
export type Order = { id: string; qty: number; amountPaise: number; status: string; createdAt: string; idea: { id: string; name: string; category: Idea['category'] } };
export type Comment = { id: string; body: string; createdAt: string; author: { id: string; name: string; handle: string } };
export type RootParams = {
  Onboarding: undefined; Phone: undefined; Setup: undefined; Tabs: undefined;
  Idea: { id: string }; Comments: { id: string; name: string }; PreOrder: { id: string }; Create: undefined; Demand: { id: string }; EditProfile: undefined;
};
