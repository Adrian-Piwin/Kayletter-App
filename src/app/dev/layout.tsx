import { notFound } from "next/navigation";

/**
 * Everything under /dev is a local tool, not a page of the product.
 *
 * The guard lives in the layout rather than in each page so a new tool is
 * dev-only by default — a gate you have to remember to add is a gate that
 * eventually ships. `NODE_ENV` is inlined at build time, so in a production
 * build this is a constant `true` and the whole subtree 404s.
 */
export default function DevLayout(props: LayoutProps<"/dev">) {
  if (process.env.NODE_ENV === "production") notFound();
  return props.children;
}
