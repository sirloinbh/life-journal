import { Label } from './components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';
import { NO_SCORE, SCORES } from './items';

/** A score from 0.5 to 5, or None; the form value is the score or NO_SCORE. */
export function ScoreField({
  id,
  label,
  name,
  value,
}: {
  id: string;
  label: string;
  name: string;
  value: number | null | undefined;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select name={name} defaultValue={value == null ? NO_SCORE : String(value)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_SCORE}>None</SelectItem>
          {SCORES.map((score) => (
            <SelectItem key={score} value={String(score)}>
              {score}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
