"use client";

import { useState } from "react";
import { levels, type BallColor } from "@/data/levels";
import RegisterModal from "./RegisterModal";

interface RegButtonProps {
  ballColor: BallColor;
  url: string;
  embedCode?: string;
}

export default function RegButton({ ballColor, url, embedCode }: RegButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const level = levels.find((l) => l.key === ballColor);
  const color = level?.color ?? "#FF4040";

  if (embedCode) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all hover:scale-105 cursor-pointer"
          style={{
            backgroundColor: color,
            color: '#000000',
            border: `1px solid ${color}30`,
          }}
        >
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          {level?.label ?? "Register"}
        </button>
        {modalOpen && (
          <RegisterModal
            embedCode={embedCode}
            fallbackUrl={url}
            levelLabel={level?.label ?? "Register"}
            levelColor={color}
            onClose={() => setModalOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all hover:scale-105"
      style={{
        backgroundColor: color,
        color: '#000000',
        border: `1px solid ${color}30`,
      }}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      {level?.label ?? "Register"}
    </a>
  );
}
