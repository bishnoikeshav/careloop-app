import ColorPatternGame from './ColorPatternGame.jsx';
import StoryRecallGame from './StoryRecallGame.jsx';
import DailyObjectsGame from './DailyObjectsGame.jsx';

/**
 * CareLoop Cognitive Stimulation Games Registry
 * Exporting all games with metadata for dynamic hub integration.
 */
export const COGNITIVE_GAMES = [
  {
    id: 'color-pattern',
    title: 'Color & Pattern Recall',
    category: 'Spatial & Sequence Memory',
    domainTag: 'Memory',
    icon: 'palette',
    difficulty: 'Easy · Adaptive',
    file: '04e-game-color-pattern.html',
    component: ColorPatternGame,
    description: 'Reproduce peaceful sequences of soft colors to strengthen active working memory.'
  },
  {
    id: 'story-recall',
    title: 'Story Recall',
    category: 'Auditory Attention & Narrative Recall',
    domainTag: 'Attention',
    icon: 'auto_stories',
    difficulty: 'Gentle · Narrative',
    file: '04f-game-story-recall.html',
    component: StoryRecallGame,
    description: 'Listen to a warm morning story from the hills and recall joyful details.'
  },
  {
    id: 'daily-objects',
    title: 'Daily Objects',
    category: 'Short-Term Visual Retention',
    domainTag: 'Visual',
    icon: 'visibility',
    difficulty: 'Relaxed · 3 Items',
    file: '04g-game-daily-objects.html',
    component: DailyObjectsGame,
    description: 'Observe everyday household items on your table and identify them from memory.'
  }
];

export {
  ColorPatternGame,
  StoryRecallGame,
  DailyObjectsGame
};
