import { Check, X } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from './components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { EmptyState } from './components/ui/empty-state';
import { cn } from './lib/utils';
import { pickQuestion, type QuizQuestion, type QuizTerm } from './terms-study-pick';

// A meaning and up to four terms of the same domain to pick from (#218). Results are not stored;
// only the learned mark can change, through the same request as the list's checkbox.
export function TermsQuiz<Term extends QuizTerm & { meaning: string }>({
  label,
  terms,
  onMarkLearned,
}: {
  label: string;
  terms: readonly Term[];
  onMarkLearned: (term: Term) => void;
}) {
  const id = useId();
  const [question, setQuestion] = useState<QuizQuestion | null>(() => pickQuestion(terms));
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, asked: 0 });

  // The question keeps ids, so a learned mark shows at once without changing the question.
  const byId = new Map(terms.map((term) => [term.id, term]));
  const answer = question ? byId.get(question.answerId) : undefined;
  const choices = question?.choiceIds.flatMap((choiceId) => byId.get(choiceId) ?? []) ?? [];

  const next = () => {
    setQuestion(pickQuestion(terms, Math.random, question?.answerId));
    setPicked(null);
  };

  if (!answer || choices.length < 2) {
    // A term gone from the server can leave a question without its answer; another one may remain.
    return pickQuestion(terms) ? (
      <div className="flex flex-col items-start gap-3">
        <p className="text-body-sm text-muted-foreground">This question is no longer available.</p>
        <Button onClick={next}>Next question</Button>
      </div>
    ) : (
      <EmptyState
        title="Not enough terms for a quiz"
        description={`A quiz needs at least two ${label} terms with different names.`}
      />
    );
  }

  const choose = (choiceId: string) => {
    if (picked !== null) return;
    setPicked(choiceId);
    setScore((current) => ({
      right: current.right + (choiceId === answer.id ? 1 : 0),
      asked: current.asked + 1,
    }));
  };

  const titleId = `${id}-title`;
  return (
    <Card>
      <CardHeader>
        <CardTitle asHeading="h2" id={titleId}>
          Which {label} term has this meaning?
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="wrap-anywhere">{answer.meaning}</p>
        <ul aria-labelledby={titleId} className="grid gap-2 sm:grid-cols-2">
          {choices.map((choice) => {
            const isAnswer = choice.id === answer.id;
            const shown = picked !== null && (isAnswer || choice.id === picked);
            return (
              <li key={choice.id}>
                {/* After an answer the choices stay focusable (aria-disabled) so the focus is kept. */}
                <Button
                  variant="outline"
                  className={cn(
                    'h-auto min-h-11 w-full justify-start py-2 text-left wrap-anywhere whitespace-normal',
                    // The answered choices stay readable instead of the faded disabled look.
                    'aria-disabled:opacity-100',
                    picked !== null && !shown && 'text-muted-foreground',
                    shown && (isAnswer ? 'border-2 border-success' : 'border-2 border-destructive'),
                  )}
                  aria-disabled={picked !== null || undefined}
                  // The marks are icons, so the name says which choice is the answer.
                  aria-label={
                    shown ? `${choice.term} (${isAnswer ? 'answer' : 'your pick'})` : undefined
                  }
                  onClick={() => choose(choice.id)}
                >
                  {shown &&
                    (isAnswer ? (
                      <Check aria-hidden className="text-success" />
                    ) : (
                      <X aria-hidden className="text-destructive" />
                    ))}
                  <span>{choice.term}</span>
                </Button>
              </li>
            );
          })}
        </ul>
        {/* Always in the page and empty until an answer, so the first result is announced too. */}
        <p role="status" className="text-body-sm font-medium wrap-anywhere">
          {picked === null
            ? null
            : picked === answer.id
              ? `Right: ${answer.term}.`
              : `Not quite. The answer is ${answer.term}.`}
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-2">
        {/* The button stays after the mark (aria-disabled), so the keyboard focus is not lost. */}
        {picked !== null && (
          <Button
            variant="secondary"
            aria-disabled={answer.learned || undefined}
            onClick={() => {
              if (!answer.learned) onMarkLearned(answer);
            }}
          >
            {answer.learned ? (
              <>
                <Check aria-hidden />
                {answer.term} is learned
              </>
            ) : (
              `Mark ${answer.term} as learned`
            )}
          </Button>
        )}
        <Button variant={picked === null ? 'ghost' : 'default'} onClick={next}>
          {picked === null ? 'Skip' : 'Next question'}
        </Button>
        <span className="ms-auto text-body-sm text-muted-foreground">
          {score.right}/{score.asked} right
        </span>
      </CardFooter>
    </Card>
  );
}
