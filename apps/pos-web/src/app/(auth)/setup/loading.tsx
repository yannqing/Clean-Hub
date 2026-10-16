import { TerminalSetupShell, TerminalStatusPanel } from "@/features/terminal-setup";

export default function TerminalSetupLoading() {
  return (
    <TerminalSetupShell>
      <TerminalStatusPanel kind="loading" />
    </TerminalSetupShell>
  );
}
