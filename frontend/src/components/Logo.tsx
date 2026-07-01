import logo from "@/assets/vigil-logo.png";
import clsx from "clsx";

export function Logo({ size = 36, withWordmark = true, className }: { size?: number; withWordmark?: boolean; className?: string }) {
  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <img
        src={logo}
        alt="Vigil"
        width={size}
        height={size}
        style={{ filter: "drop-shadow(0 0 10px rgba(34,211,238,0.55))" }}
      />
      {withWordmark && (
        <span className="font-display text-lg font-bold tracking-widest text-vigil-text">
          VIGIL<span className="text-vigil-cyan-bright">.</span>
        </span>
      )}
    </div>
  );
}
