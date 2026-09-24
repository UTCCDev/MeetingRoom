import { Fragment } from "react";

/**
 * Thai has no spaces between words, so browsers break lines by dictionary and can
 * split a phrase ("ด้าน / บน"). Write copy with a space between phrases and render
 * it through <Phrases>: each phrase stays whole and lines break only at the spaces.
 *
 * by="dot" is for "ห้อง A · อาคาร 5 ชั้น 1" style text: segments stay whole (spaces
 * inside them included) and a line may only break after a "·".
 */
export default function Phrases({ text, by = "space" }: { text: string; by?: "space" | "dot" }) {
  const parts = by === "dot" ? text.split(" · ") : text.split(" ");
  const last = parts.length - 1;
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          <span className="whitespace-nowrap">
            {part}
            {by === "dot" && i < last && " ·"}
          </span>
          {i < last && " "}
        </Fragment>
      ))}
    </>
  );
}
