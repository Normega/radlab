import { useState, useEffect, useRef, useCallback } from 'react';
import ProgressLabel from './ProgressLabel';
import InstructionScreen from './InstructionScreen';
import ScaleChangeScreen from './ScaleChangeScreen';
import LikertItem from './LikertItem';
import { buildSlides, prevNavigableIndex, effectiveLabels, isEndpointOnly,
         computeSubscaleScores, computeDerivedScores } from './questionnaireUtils';

const FADE_MS = 150; // slide transition duration

// ── QuestionnaireRenderer ──────────────────────────────────────────────────
//
// Full questionnaire player. Builds a flat slide sequence from the definition,
// manages responses, handles back navigation, and fires onComplete when done.
//
// Props:
//   questionnaire   — full JSON definition
//   partNumber      — 1-based (for progress label); default 1
//   totalParts      — total parts in session (for progress label); default 1
//   onComplete      — ({ responses, subscaleScores, derivedScores }) => void
//   onBack          — optional () => void — called if back pressed on instruction slide
//   previewMode     — bool — shows "Preview complete" at end instead of calling onComplete

export default function QuestionnaireRenderer({
  questionnaire,
  partNumber  = 1,
  totalParts  = 1,
  onComplete,
  onBack,
  previewMode = false,
}) {
  const slides    = useRef(buildSlides(questionnaire)).current;
  const [slideIdx,   setSlideIdx]   = useState(0);
  const [responses,  setResponses]  = useState({});
  const [visible,    setVisible]    = useState(true);  // fade control
  const [done,       setDone]       = useState(false);
  const transitioningRef = useRef(false);

  const currentSlide = slides[slideIdx];
  const autoAdvance  = questionnaire.auto_advance !== false; // default true

  // ── Transition helper — fade out, advance, fade in ─────────────────────
  const goTo = useCallback(async (nextIdx) => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    setVisible(false);
    await new Promise(r => setTimeout(r, FADE_MS));
    setSlideIdx(nextIdx);
    setVisible(true);
    transitioningRef.current = false;
  }, []);

  // ── Advance to next slide ──────────────────────────────────────────────
  const advance = useCallback(() => {
    const next = slideIdx + 1;
    if (next >= slides.length) {
      // All items answered — complete
      if (previewMode) { setDone(true); return; }
      const subscaleScores = computeSubscaleScores(questionnaire, responses);
      const derivedScores  = computeDerivedScores(questionnaire, subscaleScores);
      onComplete?.({ responses, subscaleScores, derivedScores });
    } else {
      goTo(next);
    }
  }, [slideIdx, slides.length, responses, questionnaire, onComplete, previewMode, goTo]);

  // ── Back navigation ────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (slideIdx === 0) {
      onBack?.();
      return;
    }
    const prev = prevNavigableIndex(slides, slideIdx);
    goTo(prev);
  }, [slideIdx, slides, onBack, goTo]);

  // ── Item response handler ──────────────────────────────────────────────
  const handleSelect = useCallback((itemId, value) => {
    setResponses(prev => ({ ...prev, [itemId]: value }));
    if (autoAdvance) {
      // LikertItem already applied 250ms visual delay — advance immediately
      advance();
    }
    // Manual mode: user taps Next button (rendered below)
  }, [autoAdvance, advance]);

  if (done && previewMode) {
    return (
      <div
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          minHeight:      '60vh',
          gap:            16,
          color:          'var(--tx2)',
          fontFamily:     'DM Sans',
          fontSize:       'var(--fs-body)',
        }}
      >
        <span style={{ fontSize: 36 }}>✓</span>
        <p>Preview complete — {Object.keys(responses).length} items answered.</p>
      </div>
    );
  }

  // ── Progress label data (only for item slides) ─────────────────────────
  const isItemSlide = currentSlide?.type === 'item';
  const labels = isItemSlide ? effectiveLabels(currentSlide.item, questionnaire) : null;
  const currentResponse = isItemSlide ? responses[currentSlide.item.id] ?? null : null;

  // Can the Next button be shown? (manual mode: need a response)
  const canNext = !autoAdvance && isItemSlide && currentResponse !== null;

  // Show back button on all slides (disabled on instruction with no onBack)
  const backDisabled = slideIdx === 0 && !onBack;

  return (
    <div
      style={{
        minHeight:  '100vh',
        background: 'var(--bg)',
        display:    'flex',
        flexDirection: 'column',
      }}
    >
      {/* Progress label — sticky top, only on item slides */}
      <ProgressLabel
        partNumber={partNumber}
        totalParts={totalParts}
        partName={questionnaire.name}
        itemIndex={isItemSlide ? currentSlide.itemDisplayIndex : null}
        totalItems={isItemSlide ? currentSlide.totalItems : null}
      />

      {/* Slide content — fade transition */}
      <div
        style={{
          flex:       1,
          opacity:    visible ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease`,
        }}
      >
        {currentSlide?.type === 'instruction' && (
          <InstructionScreen
            questionnaire={questionnaire}
            onBegin={advance}
          />
        )}

        {currentSlide?.type === 'scale_change' && (
          <ScaleChangeScreen
            slide={currentSlide}
            onContinue={advance}
          />
        )}

        {currentSlide?.type === 'item' && (
          <LikertItem
            item={currentSlide.item}
            labels={labels}
            selectedValue={currentResponse}
            onSelect={(value) => handleSelect(currentSlide.item.id, value)}
            autoAdvance={autoAdvance}
            endpointOnly={isEndpointOnly(labels)}
          />
        )}
      </div>

      {/* ── Fixed bottom bar — Back (left) + Next if manual (right) ────── */}
      <div
        style={{
          position:   'fixed',
          bottom:     0,
          left:       0,
          right:      0,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding:    '16px 24px',
          // Transparent — only buttons are visible; no background bar
          pointerEvents: 'none', // pass clicks through empty areas
        }}
      >
        {/* Back button — fixed bottom-left */}
        <button
          onClick={goBack}
          disabled={backDisabled}
          style={{
            pointerEvents:  'auto',
            background:     backDisabled ? 'transparent' : 'var(--bgc)',
            color:          backDisabled ? 'var(--tx3)' : 'var(--tx2)',
            border:         `1px solid ${backDisabled ? 'transparent' : 'var(--bd)'}`,
            borderRadius:   12,
            padding:        '10px 18px',
            fontFamily:     'DM Sans',
            fontSize:       'var(--fs-body-sm)',
            cursor:         backDisabled ? 'default' : 'pointer',
            opacity:        backDisabled ? 0 : 1,
            transition:     'opacity 200ms ease',
            boxShadow:      backDisabled ? 'none' : '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          ← Back
        </button>

        {/* Next button — bottom-right, only in manual mode on item slides */}
        {!autoAdvance && isItemSlide ? (
          <button
            onClick={advance}
            disabled={!canNext}
            style={{
              pointerEvents:  'auto',
              background:     canNext ? 'var(--pk)' : 'var(--bd)',
              color:          canNext ? '#fff' : 'var(--tx3)',
              border:         'none',
              borderRadius:   12,
              padding:        '10px 24px',
              fontFamily:     'DM Sans',
              fontSize:       'var(--fs-body-sm)',
              fontWeight:     600,
              cursor:         canNext ? 'pointer' : 'default',
              boxShadow:      canNext ? '0 2px 8px rgba(240,104,164,0.25)' : 'none',
              transition:     'background 200ms ease, box-shadow 200ms ease',
            }}
          >
            Next →
          </button>
        ) : (
          // Spacer so Back stays left-aligned
          <span style={{ pointerEvents: 'none' }} />
        )}
      </div>

      {/* Bottom padding so content clears the fixed bar */}
      <div style={{ height: 72 }} />
    </div>
  );
}
