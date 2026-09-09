import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EmptyState, PageTitle } from "@/components/site/Bits";

export function Placeholder({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <PageTitle title={title} subtitle={subtitle} />
      <EmptyState
        title="Coming in the next step"
        body="This section is being built. Your dashboard, packages and activation flow are ready to use now."
        action={
          <Button asChild>
            <Link to="/dashboard">Back to overview</Link>
          </Button>
        }
      />
    </>
  );
}
