import React, { useState, useEffect, useCallback, useRef } from 'react';

// Frequency map for the 7 basic keys (4th octave)
const NOTES = [
  { note: 'C', freq: 261.63, keyTrigger: 'c', offset: 24 },
  { note: 'D', freq: 293.66, keyTrigger: 'd', offset: 20 },
  { note: 'E', freq: 329.63, keyTrigger: 'e', offset: 16 },
  { note: 'F', freq: 349.23, keyTrigger: 'f', offset: 12 },
  { note: 'G', freq: 392.00, keyTrigger: 'g', offset: 8 },
  { note: 'A', freq: 440.00, keyTrigger: 'a', offset: 4 },
  { note: 'B', freq: 493.88, keyTrigger: 'b', offset: 0 },
];

// TIMING CONSTANTS (Milliseconds)
const DURATION_MS = {
    'S': 250,  // Short (Fast)
    'M': 500,  // Medium (Standard beat)
    'L': 1000  // Long (Held note)
};

// Songs with duration metadata
const SONGS_DATA = {
  'Ode to Joy': [
    [{n:'E', d:'M'}, {n:'E', d:'M'}, {n:'F', d:'M'}, {n:'G', d:'M'}], 
    [{n:'G', d:'M'}, {n:'F', d:'M'}, {n:'E', d:'M'}, {n:'D', d:'M'}], 
    [{n:'C', d:'M'}, {n:'C', d:'M'}, {n:'D', d:'M'}, {n:'E', d:'M'}], 
    [{n:'E', d:'L'}, {n:'D', d:'S'}, {n:'D', d:'L'}] 
  ],
  'Baby Shark': [
    [{n:'D', d:'L'}, {n:'E', d:'L'}], // Baby...
    [{n:'G', d:'S'}, {n:'G', d:'S'}, {n:'G', d:'S'}, {n:'G', d:'S'}, {n:'G', d:'S'}, {n:'G', d:'S'}, {n:'G', d:'S'}], // Shark do do..
    [{n:'D', d:'L'}, {n:'E', d:'L'}], 
    [{n:'G', d:'S'}, {n:'G', d:'S'}, {n:'G', d:'S'}, {n:'G', d:'S'}, {n:'G', d:'S'}, {n:'G', d:'S'}, {n:'G', d:'S'}],
    [{n:'G', d:'L'}, {n:'G', d:'L'}] // Grandma Shark
  ],
  'Jingle Bells': [
    [{n:'E', d:'M'}, {n:'E', d:'M'}, {n:'E', d:'L'}], 
    [{n:'E', d:'M'}, {n:'E', d:'M'}, {n:'E', d:'L'}], 
    [{n:'E', d:'M'}, {n:'G', d:'M'}, {n:'C', d:'M'}, {n:'D', d:'S'}, {n:'E', d:'L'}], 
    [{n:'F', d:'M'}, {n:'F', d:'M'}, {n:'F', d:'M'}, {n:'F', d:'S'}, {n:'F', d:'S'}], 
    [{n:'E', d:'M'}, {n:'E', d:'M'}, {n:'E', d:'M'}, {n:'E', d:'S'}, {n:'E', d:'S'}], 
    [{n:'G', d:'M'}, {n:'G', d:'M'}, {n:'F', d:'M'}, {n:'D', d:'M'}, {n:'C', d:'L'}]  
  ]
};

export default function App() {
  const [activeNote, setActiveNote] = useState(null);
  
  // Game States
  const [gameState, setGameState] = useState('IDLE'); 
  const [selectedSongName, setSelectedSongName] = useState(null);
  const [songStructure, setSongStructure] = useState([]); 
  const [flatTargetNotes, setFlatTargetNotes] = useState([]); 
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // User Recording & Scoring
  const [userHistory, setUserHistory] = useState([]); 
  const [lastNoteTime, setLastNoteTime] = useState(0);

  // Replay Logic
  const [replayState, setReplayState] = useState(null); 
  const [replayIndex, setReplayIndex] = useState(0);
  const replayTimeoutRef = useRef(null);
  const scrollContainerRef = useRef(null); 
  
  const audioContextRef = useRef(null);
  
  const initAudio = () => {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const playSound = useCallback((freq) => {
    initAudio();
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    osc.start(now);
    osc.stop(now + 1.5);
  }, []);

  const startTutorial = (songName) => {
    const structure = SONGS_DATA[songName];
    const flat = structure.flat();
    
    setGameState('PLAYING');
    setSelectedSongName(songName);
    setSongStructure(structure);
    setFlatTargetNotes(flat);
    setCurrentIndex(0);
    setUserHistory([]);
    setLastNoteTime(Date.now()); 
  };

  const calculateDelays = () => {
    if (userHistory.length === 0) return [];
    const delays = [];
    delays.push(500); 
    for (let i = 1; i < userHistory.length; i++) {
        delays.push(userHistory[i].time - userHistory[i-1].time);
    }
    return delays;
  };

  const playNextReplayNote = (index, delays) => {
    if (index >= userHistory.length) {
        setGameState('ENDED');
        setReplayState(null);
        return;
    }

    const entry = userHistory[index];
    const delay = index === 0 ? 500 : delays[index];

    replayTimeoutRef.current = setTimeout(() => {
        const noteData = NOTES.find(n => n.note === entry.note);
        if (noteData) {
            playSound(noteData.freq);
            setReplayState({ 
                note: entry.note, 
                isCorrect: entry.correct,
                timingLabel: entry.timingLabel,
                idx: index 
            });
            setTimeout(() => setReplayState(null), 300);
            setReplayIndex(index + 1);
            playNextReplayNote(index + 1, delays);
        }
    }, delay);
  };

  const startReplay = () => {
    setGameState('REPLAYING');
    setReplayIndex(0);
    const delays = calculateDelays();
    playNextReplayNote(0, delays);
  };

  const pauseReplay = () => {
    if (replayTimeoutRef.current) {
        clearTimeout(replayTimeoutRef.current);
    }
    setGameState('REPLAY_PAUSED');
  };

  const resumeReplay = () => {
    setGameState('REPLAYING');
    const delays = calculateDelays();
    playNextReplayNote(replayIndex, delays); 
  };

  const stopReplay = () => {
    if (replayTimeoutRef.current) {
        clearTimeout(replayTimeoutRef.current);
    }
    setGameState('ENDED');
    setReplayState(null);
    setReplayIndex(0);
  };

  const exitTutorial = () => {
    stopReplay(); 
    setGameState('IDLE');
    setSelectedSongName(null);
    setSongStructure([]);
    setFlatTargetNotes([]);
    setCurrentIndex(0);
    setUserHistory([]);
  };

  useEffect(() => {
    if ((gameState === 'REPLAYING' || gameState === 'REPLAY_PAUSED') && replayState && scrollContainerRef.current) {
        const bubbles = scrollContainerRef.current.querySelectorAll('.note-bubble');
        if (bubbles[replayState.idx]) {
            bubbles[replayState.idx].scrollIntoView({ 
                behavior: 'smooth', 
                inline: 'center', 
                block: 'nearest' 
            });
        }
    }
  }, [replayState, gameState]);

  const handleNoteStart = (noteData) => {
    if (gameState === 'REPLAYING' || gameState === 'REPLAY_PAUSED') return;
    
    if (activeNote === noteData.note) return;
    setActiveNote(noteData.note);
    playSound(noteData.freq);

    if (gameState === 'PLAYING') {
      const now = Date.now();
      const target = flatTargetNotes[currentIndex];
      const isCorrectPitch = noteData.note === target.n;
      
      let timingScore = 0;
      let timingLabel = '';

      if (isCorrectPitch) {
          if (currentIndex === 0) {
              timingScore = 100; 
              timingLabel = 'Perfect';
          } else {
              const actualDuration = now - lastNoteTime;
              const prevNoteDef = flatTargetNotes[currentIndex - 1];
              const targetDuration = DURATION_MS[prevNoteDef.d];
              
              const rawDiff = actualDuration - targetDuration;
              const absDiff = Math.abs(rawDiff);
              
              if (absDiff <= 120) {
                 timingScore = 100;
                 timingLabel = 'Perfect';
              } else if (absDiff <= 350) {
                 timingScore = 80;
                 timingLabel = rawDiff < 0 ? 'Fast' : 'Slow';
              } else {
                 timingScore = 40;
                 timingLabel = rawDiff < 0 ? 'Too Fast' : 'Too Slow'; 
              }
          }
      } else {
          timingLabel = 'Wrong Note';
      }

      const newHistory = [
        ...userHistory, 
        { 
            note: noteData.note, 
            correct: isCorrectPitch, 
            time: now,
            timingScore: timingScore,
            timingLabel: timingLabel,
            targetNote: target.n
        }
      ];
      setUserHistory(newHistory);
      setLastNoteTime(now);

      if (currentIndex < flatTargetNotes.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setGameState('ENDED');
      }
    }
  };

  const handleNoteEnd = () => {
    setActiveNote(null);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const noteData = NOTES.find(n => n.keyTrigger === e.key.toLowerCase());
      if (noteData && !e.repeat) {
        handleNoteStart(noteData);
      }
    };
    const handleKeyUp = (e) => {
      const noteData = NOTES.find(n => n.keyTrigger === e.key.toLowerCase());
      if (noteData) {
        handleNoteEnd();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeNote, gameState, currentIndex, userHistory, flatTargetNotes, lastNoteTime]); 

  const getFinalScore = () => {
    if (userHistory.length === 0) return 0;
    const totalScore = userHistory.reduce((acc, curr) => acc + curr.timingScore, 0);
    return Math.round(totalScore / userHistory.length);
  };
  
  // Stricter Feedback Logic (Modified)
  const getScoreLabel = () => {
      if (userHistory.length === 0) return "No data";
      
      const correctNotes = userHistory.filter(n => n.correct);
      const accuracyPct = (correctNotes.length / userHistory.length) * 100;
      
      let rhythmScore = 0;
      if (correctNotes.length > 0) {
          const totalTiming = correctNotes.reduce((acc, curr) => acc + curr.timingScore, 0);
          rhythmScore = totalTiming / correctNotes.length;
      }

      // Stricter Thresholds
      if (accuracyPct < 80) return "Too many wrong notes. Focus on accuracy.";
      if (accuracyPct < 100) return "Good notes, but aim for 100% accuracy.";
      
      // Only judge rhythm if accuracy is 100%
      if (rhythmScore >= 98) return "Virtuoso! Perfect Pitch & Timing.";
      if (rhythmScore >= 95) return "Excellent! Almost flawless timing.";
      if (rhythmScore >= 85) return "Great job, but tighten up the rhythm.";
      if (rhythmScore >= 70) return "Right keys, but the timing is loose.";
      
      return "Correct notes, but the rhythm is off.";
  };

  const renderPerformanceDisplay = () => {
    return (
        <div ref={scrollContainerRef} className="w-full max-w-4xl bg-slate-50 p-4 rounded-xl mb-6 overflow-x-auto scroll-smooth">
             <div className="flex gap-2 min-w-max pb-4 px-2 items-end h-24">
                {userHistory.map((attempt, idx) => {
                    let colorClass = 'bg-slate-200 text-slate-400';
                    let label = attempt.timingLabel;
                    
                    if (attempt.correct) {
                        if (label === 'Perfect') colorClass = 'bg-green-500 text-white ring-4 ring-green-200';
                        else if (label.includes('Fast')) colorClass = 'bg-yellow-400 text-yellow-900 ring-4 ring-yellow-100';
                        else if (label.includes('Slow')) colorClass = 'bg-purple-500 text-white ring-4 ring-purple-200';
                    } else {
                        colorClass = 'bg-red-500 text-white ring-4 ring-red-200';
                        label = 'Wrong';
                    }

                    const isReplayingCurrent = replayState && replayState.idx === idx;
                    const scaleClass = isReplayingCurrent ? 'scale-125 z-10 shadow-xl' : 'scale-100';

                    return (
                        <div key={idx} className={`note-bubble flex flex-col items-center gap-2 transition-all duration-200 ${scaleClass}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-md ${colorClass}`}>
                                {attempt.targetNote}
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                                {label}
                            </span>
                        </div>
                    )
                })}
             </div>
        </div>
    );
  };

  const renderKaraokeDisplay = () => {
    let globalNoteIndex = 0;

    return (
      <div className="flex flex-wrap justify-center items-center gap-y-8 px-4 py-8 bg-slate-50 rounded-xl inner-shadow max-w-3xl">
        {songStructure.map((phrase, phraseIdx) => (
          <div key={phraseIdx} className="flex items-center mx-3 sm:mx-6 relative h-16">
            {phrase.map((noteObj, noteIdx) => {
              const currentGlobalIndex = globalNoteIndex;
              globalNoteIndex++;
              
              const isPast = currentGlobalIndex < currentIndex;
              const isCurrent = currentGlobalIndex === currentIndex;
              const noteData = NOTES.find(n => n.note === noteObj.n);
              const verticalOffset = noteData ? noteData.offset : 0;
              
              let spacingClass = "mr-1";
              let sizeClass = "w-8 h-8 text-lg";
              
              if (noteObj.d === 'L') { spacingClass = "mr-8"; sizeClass = "w-12 h-12 text-2xl font-black"; } 
              else if (noteObj.d === 'S') { spacingClass = "mr-1"; sizeClass = "w-6 h-6 text-sm"; } 
              else { spacingClass = "mr-4"; sizeClass = "w-9 h-9 text-lg"; }

              if (noteIdx === phrase.length - 1) spacingClass = "";

              return (
                <div 
                    key={noteIdx} 
                    className={`flex flex-col items-center justify-end ${spacingClass} transition-all duration-300`}
                    style={{ transform: `translateY(${verticalOffset - 12}px)` }}
                >
                    <span 
                        className={`
                            flex items-center justify-center rounded-full shadow-sm border transition-all duration-200
                            ${sizeClass}
                            ${isPast ? 'text-slate-300 bg-slate-100 border-slate-200' : ''}
                            ${isCurrent ? 'text-green-800 bg-green-200 border-green-400 scale-110 shadow-lg z-10' : ''}
                            ${!isPast && !isCurrent ? 'text-slate-600 bg-white border-slate-300' : ''}
                        `}
                    >
                        {noteObj.n}
                    </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // EXTRACTED PIANO KEYS COMPONENT
  const renderPianoKeys = () => (
    <div className="relative p-6 bg-slate-800 rounded-2xl shadow-2xl ring-4 ring-slate-900/10 mb-8">
        <div className="flex gap-2 sm:gap-3">
          {NOTES.map((item) => {
            let keyColorClass = 'bg-white border-slate-200';
            let textColorClass = 'text-slate-700';
            let transformClass = '';
            
            if (activeNote === item.note) {
                 keyColorClass = 'bg-blue-50 border-blue-300 shadow-inner';
                 textColorClass = 'text-blue-600';
                 transformClass = 'translate-y-2'; 
            }
            else if (gameState === 'PLAYING' && flatTargetNotes[currentIndex]?.n === item.note) {
                 keyColorClass = 'bg-green-100 border-green-300 shadow-md ring-2 ring-green-400 ring-offset-2 ring-offset-slate-800'; 
                 textColorClass = 'text-green-800';
            }
            // During replay, visualize the key press
            else if ((gameState === 'REPLAYING' || gameState === 'REPLAY_PAUSED') && replayState?.note === item.note) {
                transformClass = 'translate-y-2';
                keyColorClass = 'bg-blue-100 border-blue-300 shadow-inner';
                textColorClass = 'text-blue-800';
            }

            return (
                <button
                key={item.note}
                onMouseDown={() => handleNoteStart(item)}
                onMouseUp={handleNoteEnd}
                onMouseLeave={handleNoteEnd}
                onTouchStart={(e) => { e.preventDefault(); handleNoteStart(item); }}
                onTouchEnd={(e) => { e.preventDefault(); handleNoteEnd(); }}
                disabled={gameState === 'REPLAYING' || gameState === 'REPLAY_PAUSED'}
                className={`
                    relative w-10 h-32 sm:w-14 sm:h-56 rounded-b-lg border-b-[6px] sm:border-b-8 transition-all duration-100 ease-out
                    flex flex-col justify-between items-center py-4
                    ${keyColorClass} ${transformClass}
                    ${(gameState === 'REPLAYING' || gameState === 'REPLAY_PAUSED') ? 'cursor-default' : 'hover:bg-slate-50 active:scale-[0.98]'}
                `}
                >
                <span className={`text-xl font-bold mb-1 ${textColorClass}`}>
                    {item.note}
                </span>
                <span className="text-[10px] text-slate-400 font-mono uppercase opacity-60">
                    {item.keyTrigger}
                </span>
                </button>
            );
          })}
        </div>
        <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-b from-slate-700 to-slate-800 rounded-t-2xl" />
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans text-slate-800">
      
      <div className="mb-6 text-center w-full flex flex-col items-center">
        <h1 className="text-4xl font-bold mb-2 text-slate-900 tracking-tight">Simple Piano</h1>
        
        {/* IDLE */}
        {gameState === 'IDLE' && (
           <p className="text-slate-500 mb-8 max-w-md">
             Select a song to learn. <br/>
             <span className="text-sm font-medium text-slate-400">Try to play with the right rhythm for a high score!</span>
           </p>
        )}

        {/* PLAYING - Karaoke Display */}
        {gameState === 'PLAYING' && (
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 mb-6 w-full max-w-4xl overflow-hidden">
                <div className="bg-slate-50 py-2 border-b border-slate-100 mb-4 flex justify-between px-6">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Now Playing: {selectedSongName}</h2>
                    <span className="text-xs text-slate-400 font-mono">LIVE RECORDING</span>
                </div>
                {renderKaraokeDisplay()}
                <p className="mt-4 text-xs text-slate-400">Larger bubbles = Slower • Smaller bubbles = Faster</p>
            </div>
        )}

        {/* ENDED - Results */}
        {gameState === 'ENDED' && (
             <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 mb-8 animate-in fade-in zoom-in duration-300 w-full max-w-4xl flex flex-col items-center">
                <div className="text-center mb-6">
                    <div className="mb-2">
                        <span className="text-5xl font-black text-blue-600">{getFinalScore()}</span>
                        <span className="text-xl text-slate-400 font-bold">/100</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">{getScoreLabel()}</h3>
                </div>

                <div className="w-full mb-2">
                    <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">Your Performance Timeline</h4>
                    {renderPerformanceDisplay()}
                </div>

                <div className="flex gap-4 w-full max-w-md">
                    <button 
                        onClick={startReplay}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-blue-200 shadow-lg"
                    >
                        Replay
                    </button>
                    <button 
                        onClick={exitTutorial}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-6 py-3 rounded-xl transition-colors"
                    >
                        Menu
                    </button>
                </div>
             </div>
        )}

        {/* REPLAYING - Controls & Timeline */}
        {(gameState === 'REPLAYING' || gameState === 'REPLAY_PAUSED') && (
            <>
                 {/* No top keys, reusing bottom */}
                 <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 mb-8 w-full max-w-4xl flex flex-col items-center">
                    <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Replaying...</h4>
                    {renderPerformanceDisplay()}
                    
                    <div className="flex gap-2 w-full max-w-xs mt-4">
                        {gameState === 'REPLAYING' ? (
                             <button onClick={pauseReplay} className="flex-1 bg-amber-100 text-amber-800 py-2 rounded-lg hover:bg-amber-200 font-medium">Pause</button>
                        ) : (
                             <button onClick={resumeReplay} className="flex-1 bg-green-100 text-green-800 py-2 rounded-lg hover:bg-green-200 font-medium">Resume</button>
                        )}
                        <button onClick={stopReplay} className="flex-1 bg-red-100 text-red-800 py-2 rounded-lg hover:bg-red-200 font-medium">Stop</button>
                    </div>
                 </div>
            </>
        )}
      </div>

      {/* PIANO BOARD ALWAYS BOTTOM */}
      {renderPianoKeys()}

      {/* Tutorial Menu */}
      {gameState === 'IDLE' && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl px-4">
            {Object.keys(SONGS_DATA).map(song => (
                <button
                    key={song}
                    onClick={() => startTutorial(song)}
                    className="group relative flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
                >
                    <span className="font-bold text-slate-700 text-lg group-hover:text-blue-600 transition-colors">{song}</span>
                    <span className="text-xs text-slate-400 mt-2 font-medium bg-slate-100 px-2 py-1 rounded-full">Easy</span>
                </button>
            ))}
        </div>
      )}
      
      {gameState === 'PLAYING' && (
        <button 
            onClick={exitTutorial} 
            className="mt-8 text-slate-400 hover:text-red-500 text-sm font-medium transition-colors"
        >
            Quit Tutorial
        </button>
      )}

    </div>
  );
}