import cover1 from "@/assets/cover-1.jpg";
import cover2 from "@/assets/cover-2.jpg";
import cover3 from "@/assets/cover-3.jpg";
import cover4 from "@/assets/cover-4.jpg";
import cover5 from "@/assets/cover-5.jpg";
import hero from "@/assets/hero-featured.jpg";
import panel1 from "@/assets/panel-1.jpg";
import panel2 from "@/assets/panel-2.jpg";
import panel3 from "@/assets/panel-3.jpg";

export const featured = {
  slug: "the-last-sovereign-of-void",
  title: "The Last Sovereign of Void",
  tags: ["Action", "Fantasy"],
  hero,
  cover: cover2,
  synopsis:
    "When the veil between realms thins, a forgotten heir must reclaim the throne before the eternal night consumes the seven kingdoms.",
  episode: 48,
  panels: [
    { src: panel1, w: 800, h: 1216 },
    { src: panel2, w: 800, h: 1600 },
    { src: panel3, w: 800, h: 1024 },
  ],
};

export type Series = {
  slug: string;
  title: string;
  genre: string;
  cover: string;
  episode: number;
  released: string;
};

export const series: Series[] = [
  {
    slug: "neon-protocol",
    title: "Neon Protocol",
    genre: "Sci-Fi / Action",
    cover: cover1,
    episode: 142,
    released: "2h ago",
  },
  {
    slug: "ascension-theory",
    title: "Ascension Theory",
    genre: "Fantasy",
    cover: cover2,
    episode: 89,
    released: "5h ago",
  },
  {
    slug: "crimson-vow",
    title: "Crimson Vow",
    genre: "Romance / Dark",
    cover: cover3,
    episode: 12,
    released: "1d ago",
  },
  {
    slug: "system-breaker",
    title: "System Breaker",
    genre: "Urban / Leveling",
    cover: cover4,
    episode: 204,
    released: "2d ago",
  },
  {
    slug: "iron-fist-spirit",
    title: "Iron Fist Spirit",
    genre: "Shonen / Action",
    cover: cover5,
    episode: 56,
    released: "3d ago",
  },
];
