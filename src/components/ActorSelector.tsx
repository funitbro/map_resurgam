import type { ActorMode } from "../data/types";

const options: ActorMode[] = ["Russia", "USA", "China", "Compare"];

type Props = {
  value: ActorMode;
  onChange: (value: ActorMode) => void;
};

export function ActorSelector({ value, onChange }: Props) {
  return (
    <fieldset className="control-group" aria-label="Actor selector">
      <legend>Actor</legend>
      <div className="segmented">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={value === option ? "active" : ""}
            onClick={() => onChange(option)}
            aria-pressed={value === option}
          >
            {option === "Compare" ? "Compare actors" : option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

