/**
 * Meeting transcript parser and structured notes extractor
 * Extracts participants, topics, decisions, action items from raw meeting transcripts
 */

export interface ActionItem {
  assignee: string;
  task: string;
  dueDate?: string;
}

export interface ParsedNotes {
  summary: string;
  topics: string[];
  decisions: string[];
  actionItems: ActionItem[];
}

const TIMESTAMP_PATTERN = /\[\d{2}:\d{2}\]|\d{1,2}:\d{2}\s*(AM|PM)?/i;
const SPEAKER_NAME_PATTERN = /^[A-Z][a-z]+:/m;
const MENTION_PATTERN = /@[A-Za-z]+/g;

const DECISION_PATTERNS = [
  /^DECISION:\s*(.+)$/gm,
  /^AGREED:\s*(.+)$/gm,
  /We decided to\s+(.+?)(?:\.|\n|$)/g,
  /Let's go with\s+(.+?)(?:\.|\n|$)/g,
];

const ACTION_ITEM_PATTERNS = [
  /^ACTION:\s*@?([A-Za-z]+)\s+(?:will\s+)?(.+)$/gm,
  /^TODO:\s*([A-Za-z]+)\s+to\s+(.+)$/gm,
  /@([A-Za-z]+)\s+will\s+(.+?)(?:\.|\n|$)/g,
  /\[([A-Za-z]+)\]\s+should\s+(.+?)(?:\.|\n|$)/g,
];

const DUE_DATE_PATTERNS = [
  /by\s+(\w+)/g,
  /due\s+(\d{4}-\d{2}-\d{2})/g,
  /before\s+(next\s+\w+)/g,
];

function extractParticipants(text: string): string[] {
  const participants = new Set<string>();
  const lines = text.split("\n");

  for (const line of lines) {
    // Match "Name:" at start of line
    const speakerMatch = line.match(/^([A-Z][a-z]+):/);
    if (speakerMatch) {
      participants.add(speakerMatch[1]);
    }

    // Match @Name mentions
    const mentionMatches = line.match(/@([A-Za-z]+)/g);
    if (mentionMatches) {
      for (const mention of mentionMatches) {
        participants.add(mention.substring(1));
      }
    }
  }

  return Array.from(participants);
}

function extractTopics(text: string): string[] {
  const topics = new Set<string>();
  const lines = text.split("\n");
  const keywordCounts = new Map<string, number>();

  // Look for explicit topic markers
  for (const line of lines) {
    const topicMatch = line.match(/^(TOPIC|Agenda):\s*(.+)$/i);
    if (topicMatch) {
      topics.add(topicMatch[2].trim());
    }
  }

  // Count recurring keywords (words appearing 3+ times, excluding common words)
  const commonWords = new Set([
    "the", "and", "for", "that", "this", "with", "you", "are", "was", "have",
    "but", "not", "all", "can", "had", "her", "one", "our", "out", "has",
    "his", "how", "its", "may", "new", "now", "old", "see", "way", "who",
    "did", "get", "let", "say", "she", "too", "use", "we'll", "will"
  ]);

  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  for (const word of words) {
    if (!commonWords.has(word)) {
      keywordCounts.set(word, (keywordCounts.get(word) || 0) + 1);
    }
  }

  // Add frequently mentioned words as potential topics - capitalize first letter
  for (const [word, count] of keywordCounts.entries()) {
    if (count >= 3 && word.length > 4) {
      const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
      topics.add(capitalized);
    }
  }

  return Array.from(topics);
}

function extractDecisions(text: string): string[] {
  const decisions: string[] = [];

  for (const pattern of DECISION_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const decision = match[1]?.trim();
      if (decision && decision.length > 5) {
        decisions.push(decision);
      }
    }
  }

  return [...new Set(decisions)];
}

function extractDueDate(taskText: string): { task: string; dueDate?: string } {
  let dueDate: string | undefined;
  let cleanTask = taskText;

  // Try to match due date patterns - check at end of string first
  const endPatterns = [
    /\s+by\s+(\w+)\s*$/i,
    /\s+due\s+(\d{4}-\d{2}-\d{2})\s*$/i,
    /\s+before\s+(next\s+\w+)\s*$/i,
  ];

  for (const pattern of endPatterns) {
    const match = taskText.match(pattern);
    if (match) {
      dueDate = match[1];
      // Remove the due date phrase from task text
      cleanTask = taskText.replace(match[0], "").trim();
      break;
    }
  }

  // If not found at end, try anywhere in the text
  if (!dueDate) {
    const anyPatterns = [
      /by\s+(\w+)/i,
      /due\s+(\d{4}-\d{2}-\d{2})/i,
      /before\s+(next\s+\w+)/i,
    ];

    for (const pattern of anyPatterns) {
      const match = taskText.match(pattern);
      if (match) {
        dueDate = match[1];
        cleanTask = taskText.replace(match[0], "").trim();
        break;
      }
    }
  }

  return { task: cleanTask, dueDate };
}

function extractActionItems(text: string): ActionItem[] {
  const actionItems: ActionItem[] = [];

  for (const pattern of ACTION_ITEM_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const assignee = match[1]?.trim();
      const taskRaw = match[2]?.trim();

      if (assignee && taskRaw && taskRaw.length > 3) {
        const { task, dueDate } = extractDueDate(taskRaw);
        actionItems.push({
          assignee,
          task: task.endsWith(".") ? task.slice(0, -1) : task,
          dueDate,
        });
      }
    }
  }

  return actionItems;
}

function generateSummary(text: string, notes: ParsedNotes): string {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const firstFewSentences = lines.slice(0, 3).join(" ");
  const preview = firstFewSentences.length > 150
    ? firstFewSentences.substring(0, 150) + "..."
    : firstFewSentences;

  const parts: string[] = [];

  if (preview) {
    parts.push(preview);
  }

  if (notes.topics.length > 0) {
    parts.push(`Covered ${notes.topics.length} topic(s).`);
  }

  if (notes.decisions.length > 0) {
    parts.push(`Made ${notes.decisions.length} decision(s).`);
  }

  if (notes.actionItems.length > 0) {
    parts.push(`Assigned ${notes.actionItems.length} action item(s).`);
  }

  // If no content was generated, create a minimal summary mentioning topics
  if (parts.length === 0 && notes.topics.length > 0) {
    return `Meeting covered ${notes.topics.length} topic(s).`;
  }

  return parts.join(" ");
}

export function parseTranscript(text: string): ParsedNotes {
  // Handle empty or whitespace-only input
  if (!text || text.trim().length === 0) {
    return {
      summary: "",
      topics: [],
      decisions: [],
      actionItems: [],
    };
  }

  const topics = extractTopics(text);
  const decisions = extractDecisions(text);
  const actionItems = extractActionItems(text);

  const notes: ParsedNotes = {
    summary: "",
    topics,
    decisions,
    actionItems,
  };

  notes.summary = generateSummary(text, notes);

  return notes;
}

export function isMeetingTranscript(content: string): boolean {
  if (!content || content.trim().length === 0) {
    return false;
  }

  const hasTimestamps = TIMESTAMP_PATTERN.test(content);
  const hasSpeakers = SPEAKER_NAME_PATTERN.test(content) || MENTION_PATTERN.test(content);

  return hasTimestamps && hasSpeakers;
}
