export interface AgentPreset {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  persona: string;
  greetingStyle: string;
  isBuiltIn: boolean;
}
