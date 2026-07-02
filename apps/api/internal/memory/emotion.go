package memory

import "github.com/cosimosi/api/internal/platform/values"

type Mood string

const (
	MoodJoy        Mood = "JOY"
	MoodCalm       Mood = "CALM"
	MoodSad        Mood = "SAD"
	MoodAnger      Mood = "ANGER"
	MoodFear       Mood = "FEAR"
	MoodLove       Mood = "LOVE"
	MoodNeutral    Mood = "NEUTRAL"
	MoodExcitement Mood = "EXCITEMENT"
	MoodGratitude  Mood = "GRATITUDE"
	MoodRelief     Mood = "RELIEF"
	MoodStress     Mood = "STRESS"
	MoodTired      Mood = "TIRED"
	MoodEmptiness  Mood = "EMPTINESS"
)

type EmotionQuadrant string

const (
	EmotionQuadrantPositiveHighArousal EmotionQuadrant = "positive_high_arousal"
	EmotionQuadrantPositiveLowArousal  EmotionQuadrant = "positive_low_arousal"
	EmotionQuadrantNegativeHighArousal EmotionQuadrant = "negative_high_arousal"
	EmotionQuadrantNegativeLowArousal  EmotionQuadrant = "negative_low_arousal"
	EmotionQuadrantNeutral             EmotionQuadrant = "neutral"
)

type EmotionCoordinate struct {
	Valence float64
	Arousal float64
}

type Emotion struct {
	Mood      Mood
	Valence   float64
	Arousal   float64
	Intensity float64
}

type moodDefinition struct {
	mood     Mood
	valueKey string
	quadrant EmotionQuadrant
}

var moodCatalog = []moodDefinition{
	{mood: MoodJoy, valueKey: "joy", quadrant: EmotionQuadrantPositiveHighArousal},
	{mood: MoodCalm, valueKey: "calm", quadrant: EmotionQuadrantPositiveLowArousal},
	{mood: MoodSad, valueKey: "sad", quadrant: EmotionQuadrantNegativeLowArousal},
	{mood: MoodAnger, valueKey: "anger", quadrant: EmotionQuadrantNegativeHighArousal},
	{mood: MoodFear, valueKey: "fear", quadrant: EmotionQuadrantNegativeHighArousal},
	{mood: MoodLove, valueKey: "love", quadrant: EmotionQuadrantPositiveHighArousal},
	{mood: MoodNeutral, valueKey: "neutral", quadrant: EmotionQuadrantNeutral},
	{mood: MoodExcitement, valueKey: "excitement", quadrant: EmotionQuadrantPositiveHighArousal},
	{mood: MoodGratitude, valueKey: "gratitude", quadrant: EmotionQuadrantPositiveLowArousal},
	{mood: MoodRelief, valueKey: "relief", quadrant: EmotionQuadrantPositiveLowArousal},
	{mood: MoodStress, valueKey: "stress", quadrant: EmotionQuadrantNegativeHighArousal},
	{mood: MoodTired, valueKey: "tired", quadrant: EmotionQuadrantNegativeLowArousal},
	{mood: MoodEmptiness, valueKey: "emptiness", quadrant: EmotionQuadrantNegativeLowArousal},
}

var (
	allMoods         = make([]Mood, 0, len(moodCatalog))
	moodDefinitionBy = make(map[Mood]moodDefinition, len(moodCatalog))
)

func init() {
	for _, definition := range moodCatalog {
		allMoods = append(allMoods, definition.mood)
		moodDefinitionBy[definition.mood] = definition
	}
}

func AllMoods() []Mood {
	return append([]Mood(nil), allMoods...)
}

func MoodQuadrant(mood Mood) (EmotionQuadrant, bool) {
	definition, ok := moodDefinitionBy[mood]
	return definition.quadrant, ok
}

func MoodCoordinate(mood Mood) (EmotionCoordinate, bool) {
	key, ok := moodValueKey(mood)
	if !ok {
		return EmotionCoordinate{}, false
	}
	valence, ok := values.EmotionMoodValence[key]
	if !ok {
		return EmotionCoordinate{}, false
	}
	arousal, ok := values.EmotionMoodArousal[key]
	if !ok {
		return EmotionCoordinate{}, false
	}
	return EmotionCoordinate{Valence: valence, Arousal: arousal}, true
}

func NewEmotion(mood Mood) (Emotion, bool) {
	return NewEmotionWithIntensity(mood, values.EmotionDefaultIntensity)
}

func NewEmotionWithIntensity(mood Mood, intensity float64) (Emotion, bool) {
	coordinate, ok := MoodCoordinate(mood)
	if !ok {
		return Emotion{}, false
	}
	return Emotion{
		Mood:      mood,
		Valence:   coordinate.Valence,
		Arousal:   coordinate.Arousal,
		Intensity: intensity,
	}, true
}

func ArousalToInitialStrength(arousal float64) float64 {
	if arousal < 0 {
		arousal = 0
	}
	if arousal > 1 {
		arousal = 1
	}
	return values.EmotionArousalStrengthMin + arousal*(values.EmotionArousalStrengthMax-values.EmotionArousalStrengthMin)
}

func moodValueKey(mood Mood) (string, bool) {
	definition, ok := moodDefinitionBy[mood]
	return definition.valueKey, ok
}
