import { useState, useEffect, useRef, useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Path, Rect, Line } from 'react-native-svg';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  Image, Animated, PanResponder, ActivityIndicator,
  Share, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  doc, setDoc, updateDoc, arrayUnion, onSnapshot, getDoc,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';
const copyToClipboard = (text: string) => {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    navigator.clipboard?.writeText(text);
  }
};
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getWatchableMovies, type Movie } from '../../lib/streaming-filter';
import { getTrending, type MovieResult } from '../../lib/tmdb';
import { TMDB_IMAGE_BASE } from '../../constants/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppMode = 'selector' | 'solo-swipe' | 'solo-picks' | 'solo-bracket' | 'solo-result'
             | 'group-waiting' | 'group-swipe' | 'group-results' | 'group-bracket' | 'group-result';

interface SessionMember { uid: string; name: string; initials: string; }
interface Session {
  code: string;
  hostUid: string;
  hostName?: string;
  memberNames?: Record<string, string>;
  members: string[];
  memberProfiles: SessionMember[];
  status: 'waiting' | 'active' | 'swiping' | 'done' | 'ended';
  movies: number[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Fix 1: timestamp + random suffix guarantees uniqueness
function generateSessionCode(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${ts}-${rand}`;
}

function initials(name: string): string {
  const parts = name.trim().split(' ');
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

const gradientStyle =
  Platform.OS === 'web'
    ? ({ background: 'linear-gradient(135deg, #4C1D95, #7C3AED)' } as any)
    : { backgroundColor: '#6D28D9' };

const cardOverlayStyle =
  Platform.OS === 'web'
    ? ({ background: 'linear-gradient(to top, rgba(10,10,15,0.85), transparent)' } as any)
    : { backgroundColor: 'rgba(10,10,15,0.6)' };

// ─── Small shared components ──────────────────────────────────────────────────

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.35 }]}>{initials(name)}</Text>
    </View>
  );
}

function MoviePoster({ posterPath, width, height }: { posterPath: string | null; width: number; height: number }) {
  if (posterPath) {
    return (
      <Image
        source={{ uri: `${TMDB_IMAGE_BASE}${posterPath}` }}
        style={{ width, height, borderRadius: 8 }}
        resizeMode="cover"
      />
    );
  }
  return <View style={[styles.posterPlaceholder, { width, height }]} />;
}

// ─── Mode Selector Icons ──────────────────────────────────────────────────────

function SoloModeIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 36 36" fill="none">
      <Circle cx={18} cy={13} r={5} stroke="#6D28D9" strokeWidth={1.5} />
      <Path d="M7 32 C7 24 11 20 18 20 C25 20 29 24 29 32" stroke="#6D28D9" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function GroupModeIcon() {
  return (
    <Svg width={36} height={24} viewBox="0 0 36 24" fill="none">
      {/* Left phone: 10×18 at (1, 3) */}
      <Rect x={1} y={3} width={10} height={18} rx={2} stroke="#6D28D9" strokeWidth={1.5} />
      {/* Right phone: 9×16 at (25, 5) — 6px right, 2px lower */}
      <Rect x={25} y={5} width={9} height={16} rx={2} stroke="#7C3AED" strokeWidth={1.5} />
      {/* Centre dot */}
      <Circle cx={18} cy={12} r={3} fill="#6D28D9" />
      {/* Lines from dot to each phone */}
      <Line x1={11} y1={12} x2={15} y2={12} stroke="#6D28D9" strokeWidth={1} strokeLinecap="round" />
      <Line x1={21} y1={12} x2={25} y2={12} stroke="#6D28D9" strokeWidth={1} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Skeleton / error / empty states ─────────────────────────────────────────

function MovieReelIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
      <Circle cx={16} cy={16} r={14} stroke="#6D28D9" strokeWidth={1.5} />
      <Circle cx={16} cy={16} r={5} stroke="#6D28D9" strokeWidth={1.5} />
      <Circle cx={8} cy={8} r={2} fill="#6D28D9" />
      <Circle cx={24} cy={8} r={2} fill="#6D28D9" />
      <Circle cx={8} cy={24} r={2} fill="#6D28D9" />
      <Circle cx={24} cy={24} r={2} fill="#6D28D9" />
    </Svg>
  );
}

function SwipeCardSkeleton() {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <ScrollView style={styles.swipeScroll} contentContainerStyle={styles.swipeWrap}>
      <Animated.View style={[styles.swipeCard, styles.skeletonCard, { opacity: anim }]}>
        <View style={[styles.swipePoster, styles.skeletonBg]} />
      </Animated.View>
      <View style={styles.actionRow}>
        <View style={[styles.skipBtn, styles.skeletonBg]} />
        <View style={[styles.acceptBtn, styles.skeletonBg]} />
      </View>
    </ScrollView>
  );
}

function DecideFetchError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.centered}>
      <View style={styles.errorIconWrap}>
        <Text style={styles.errorTriangle}>⚠</Text>
      </View>
      <Text style={styles.errorTitle}>something went wrong</Text>
      <TouchableOpacity onPress={onRetry}>
        <Text style={styles.errorRetry}>tap to try again</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyQueueState({ onBrowseAll }: { onBrowseAll: () => void }) {
  return (
    <View style={styles.centered}>
      <View style={styles.emptyIllustration}>
        <MovieReelIcon />
      </View>
      <Text style={styles.emptyQueueTitle}>no movies found for your streaming services</Text>
      <TouchableOpacity
        style={[styles.primaryBtn, gradientStyle, { marginTop: 8 }]}
        onPress={() => router.push({ pathname: '/(onboarding)/streaming', params: { edit: '1' } })}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryBtnText}>update streaming services</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.secondaryBtn, { marginTop: 8 }]}
        onPress={onBrowseAll}
        activeOpacity={0.85}
      >
        <Text style={styles.secondaryBtnText}>browse all popular movies</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Mode Selector ────────────────────────────────────────────────────────────

function ModeSelector({ onSolo, onGroup }: { onSolo: () => void; onGroup: () => void }) {
  return (
    <View style={styles.selectorWrap}>
      <Text style={styles.selectorTitle}>decide</Text>
      <Text style={styles.selectorSub}>what are you watching tonight?</Text>
      <View style={styles.modeRow}>
        {/* Just me card */}
        <TouchableOpacity style={styles.modeCard} onPress={onSolo} activeOpacity={0.85}>
          <View style={styles.modeIconWrap}>
            <SoloModeIcon />
          </View>
          <Text style={styles.modeLabel}>just me</Text>
          <Text style={styles.modeSub}>from your streaming services</Text>
        </TouchableOpacity>
        {/* With friends card */}
        <TouchableOpacity style={styles.modeCard} onPress={onGroup} activeOpacity={0.85}>
          <View style={styles.modeIconWrap}>
            <GroupModeIcon />
          </View>
          <Text style={styles.modeLabel}>with friends</Text>
          <Text style={styles.modeSub}>up to 4 · shared queue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Solo Swipe Screen ────────────────────────────────────────────────────────

function SoloSwipe({
  uid, onDone,
}: { uid: string; onDone: (picks: Movie[]) => void }) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const pan = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        let list = await getWatchableMovies(uid);
        if (list.length > 0 && list.length < 5) {
          const [p1, p2] = await Promise.all([
            getTrending(1).catch(() => [] as MovieResult[]),
            getTrending(2).catch(() => [] as MovieResult[]),
          ]);
          const existingIds = new Set(list.map(m => m.id));
          const padding = [...p1, ...p2]
            .filter(m => !existingIds.has(m.id))
            .slice(0, 20 - list.length) as Movie[];
          list = [...list, ...padding];
        }
        if (!cancelled) { setMovies(list); setLoading(false); }
      } catch {
        if (!cancelled) { setError(true); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [uid, retryCount]);

  const handleBrowseAll = async () => {
    setLoading(true);
    setError(false);
    try {
      const [p1, p2] = await Promise.all([
        getTrending(1).catch(() => [] as MovieResult[]),
        getTrending(2).catch(() => [] as MovieResult[]),
      ]);
      setMovies([...p1, ...p2] as Movie[]);
    } catch { setError(true); }
    finally { setLoading(false); }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
      onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > 80) { handleAccept(); }
        else if (g.dx < -80) { handleSkip(); }
        else { Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start(); }
      },
    }),
  ).current;

  const handleAccept = useCallback(() => {
    const movie = movies[index];
    if (!movie) return;
    Animated.timing(pan, { toValue: { x: 400, y: 0 }, duration: 200, useNativeDriver: false }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      setPicks(p => [...p, movie]);
      setIndex(i => movies.length > 0 ? (i + 1) % movies.length : 0);
    });
  }, [movies, index]);

  const handleSkip = useCallback(() => {
    const movie = movies[index];
    if (!movie) return;
    Animated.timing(pan, { toValue: { x: -400, y: 0 }, duration: 200, useNativeDriver: false }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      setIndex(i => movies.length > 0 ? (i + 1) % movies.length : 0);
    });
  }, [movies, index]);

  const current = movies[index];

  if (loading) return <SwipeCardSkeleton />;
  if (error) return <DecideFetchError onRetry={() => setRetryCount(c => c + 1)} />;
  if (movies.length === 0) return <EmptyQueueState onBrowseAll={handleBrowseAll} />;

  const rotate = pan.x.interpolate({ inputRange: [-200, 0, 200], outputRange: ['-8deg', '0deg', '8deg'] });

  return (
    <ScrollView
      style={styles.swipeScroll}
      contentContainerStyle={styles.swipeWrap}
      showsVerticalScrollIndicator={false}
    >
      {/* Card */}
      <Animated.View
        style={[styles.swipeCard, { transform: [{ translateX: pan.x }, { rotate }] }]}
        {...panResponder.panHandlers}
      >
        {current?.posterPath ? (
          <Image
            source={{ uri: `${TMDB_IMAGE_BASE}${current.posterPath}` }}
            style={styles.swipePoster}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.swipePosterPlaceholder} />
        )}
        <View style={[styles.swipeOverlay, cardOverlayStyle]}>
          <Text style={styles.swipeTitle}>{current?.title}</Text>
          <Text style={styles.swipeMeta}>
            {current?.streamingServices?.[0] ?? '—'} · {current?.year}
          </Text>
        </View>
      </Animated.View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.8}>
          <Text style={styles.skipIcon}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.8}>
          <Text style={styles.acceptIcon}>✓</Text>
        </TouchableOpacity>
      </View>

      {picks.length >= 3 && (
        <TouchableOpacity onPress={() => onDone(picks)}>
          <Text style={styles.seePicksLink}>see my picks →</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ─── Picks Screen ─────────────────────────────────────────────────────────────

function PicksScreen({
  picks, onPickOne, onBracket, onBack,
}: { picks: Movie[]; onPickOne: () => void; onBracket: () => void; onBack: () => void }) {
  if (picks.length < 2) {
    return (
      <View style={styles.picksWrap}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← back</Text>
        </TouchableOpacity>
        <View style={styles.emptyState}>
          <View style={styles.emptyIllustration} />
          <Text style={styles.emptyTitle}>no picks yet</Text>
          <Text style={styles.emptySub}>go back and select movies you're in the mood for</Text>
          <TouchableOpacity style={styles.backToBrowseBtn} onPress={onBack} activeOpacity={0.85}>
            <Text style={styles.backToBrowseText}>back to browsing</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.picksWrap}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>← back</Text>
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>your picks</Text>
      <View style={styles.picksGrid}>
        {picks.map(m => (
          <View key={m.id} style={styles.pickCard}>
            <MoviePoster posterPath={m.posterPath} width={130} height={80} />
            <Text style={styles.pickTitle} numberOfLines={2}>{m.title}</Text>
            {m.streamingServices?.[0] && (
              <View style={styles.serviceBadge}>
                <Text style={styles.serviceBadgeText}>{m.streamingServices[0]}</Text>
              </View>
            )}
          </View>
        ))}
      </View>
      <TouchableOpacity style={[styles.primaryBtn, gradientStyle, { marginTop: 16 }]} onPress={onPickOne} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>pick one now</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 10 }]} onPress={onBracket} activeOpacity={0.85}>
        <Text style={styles.secondaryBtnText}>bracket round</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Result Screen ────────────────────────────────────────────────────────────

function ResultScreen({ movie, onReset }: { movie: Movie; onReset: () => void }) {
  return (
    <View style={styles.resultWrap}>
      <Text style={styles.resultLabel}>tonight you're watching</Text>
      <View style={{ alignItems: 'center', marginVertical: 20 }}>
        <MoviePoster posterPath={movie.posterPath} width={160} height={240} />
      </View>
      <Text style={styles.resultTitle}>{movie.title}</Text>
      <Text style={styles.resultSub}>enjoy your movie</Text>
      <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 24 }]} onPress={onReset}>
        <Text style={styles.secondaryBtnText}>start over</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Bracket Screen ───────────────────────────────────────────────────────────

function BracketScreen({ initial, onWinner }: { initial: Movie[]; onWinner: (m: Movie) => void }) {
  const [round, setRound] = useState(initial.slice());
  const [pairIndex, setPairIndex] = useState(0);
  const [winners, setWinners] = useState<Movie[]>([]);

  const left  = round[pairIndex * 2];
  const right = round[pairIndex * 2 + 1];
  const totalPairs = Math.floor(round.length / 2);

  const pick = (winner: Movie) => {
    const next = [...winners, winner];
    if (pairIndex + 1 < totalPairs) {
      setWinners(next);
      setPairIndex(i => i + 1);
    } else {
      // odd one out if uneven
      const remaining = round.length % 2 === 1 ? [...next, round[round.length - 1]] : next;
      if (remaining.length === 1) {
        onWinner(remaining[0]);
      } else {
        setRound(remaining);
        setPairIndex(0);
        setWinners([]);
      }
    }
  };

  if (!left) { onWinner(round[0]); return null; }

  return (
    <View style={styles.bracketWrap}>
      <Text style={styles.sectionTitle}>bracket</Text>
      <Text style={styles.bracketRound}>round · {round.length} remaining</Text>

      <View style={styles.bracketRow}>
        <TouchableOpacity style={styles.bracketCard} onPress={() => pick(left)} activeOpacity={0.85}>
          <MoviePoster posterPath={left.posterPath} width={120} height={160} />
          <Text style={styles.bracketTitle} numberOfLines={2}>{left.title}</Text>
        </TouchableOpacity>

        <Text style={styles.vsText}>vs</Text>

        <TouchableOpacity style={styles.bracketCard} onPress={() => pick(right!)} activeOpacity={0.85}>
          <MoviePoster posterPath={right?.posterPath ?? null} width={120} height={160} />
          <Text style={styles.bracketTitle} numberOfLines={2}>{right?.title}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Group Waiting Room ───────────────────────────────────────────────────────

function GroupWaiting({
  uid, displayName, onStart, onBack, initialCode,
}: { uid: string; displayName: string; onStart: (session: Session) => void; onBack: () => void; initialCode?: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  // Fix 1+5: refs for code, status, and whether the host deliberately started
  const codeRef = useRef<string | null>(null);
  const sessionStatusRef = useRef<string>('waiting');
  const startedRef = useRef(false);
  const isHost = !initialCode;

  useEffect(() => {
    let cancelled = false;
    let cleanupListener: (() => void) | null = null;

    const startListening = (code: string) => {
      cleanupListener = onSnapshot(doc(db, 'sessions', code), async snap => {
        if (cancelled) return;
        const data = snap.data() as Session | undefined;
        if (!data) return;
        sessionStatusRef.current = data.status; // Fix 5: track live status
        const profiles: SessionMember[] = await Promise.all(
          data.members.map(async mUid => {
            try {
              const u = await getDoc(doc(db, 'users', mUid));
              const d = u.data();
              const nameParts = `${d?.firstName ?? ''} ${d?.lastName ?? ''}`.trim();
              const name = ((d?.displayName as string | undefined) ?? nameParts) || mUid;
              return { uid: mUid, name, initials: initials(name) };
            } catch {
              return { uid: mUid, name: mUid, initials: '?' };
            }
          }),
        );
        if (!cancelled) setSession({ ...data, memberProfiles: profiles });
      });
    };

    if (initialCode) {
      // Joiner: attach to existing session
      codeRef.current = initialCode;
      updateDoc(doc(db, 'sessions', initialCode), {
        members: arrayUnion(uid),
        [`memberNames.${uid}`]: displayName,
      }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
      startListening(initialCode);
    } else {
      // Fix 1: host creates session with guaranteed unique code
      (async () => {
        try {
          const code1 = generateSessionCode();
          const existing = await getDoc(doc(db, 'sessions', code1)).catch(() => null);
          const finalCode = existing?.exists() ? generateSessionCode() : code1;
          codeRef.current = finalCode;

          const expiresAt = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

          await setDoc(doc(db, 'sessions', finalCode), {
            code: finalCode,
            hostUid: uid,
            hostName: displayName,
            members: [uid],
            memberNames: { [uid]: displayName },
            status: 'waiting',
            movies: [],
            createdAt: serverTimestamp(),
            expiresAt,
          });

          if (!cancelled) {
            setLoading(false);
            startListening(finalCode);
          }
        } catch {
          if (!cancelled) setLoading(false);
        }
      })();
    }

    return () => {
      cancelled = true;
      cleanupListener?.();
      // Fix 5: if host leaves without starting, mark session ended
      if (isHost && codeRef.current && !startedRef.current && sessionStatusRef.current === 'waiting') {
        updateDoc(doc(db, 'sessions', codeRef.current), { status: 'ended' }).catch(() => {});
      }
    };
  }, [uid, displayName, initialCode]);

  // Fix 5: mark as active before unmounting so cleanup doesn't end it
  const handleStart = (s: Session) => {
    startedRef.current = true;
    if (codeRef.current) {
      updateDoc(doc(db, 'sessions', codeRef.current), { status: 'active' }).catch(() => {});
    }
    onStart(s);
  };

  if (loading || !session) {
    return <View style={styles.centered}><ActivityIndicator color="#6D28D9" /></View>;
  }

  // Fix 2: invite URL always derived from the Firestore session.code
  const inviteUrl = `https://kforgues1.github.io/allscreens/join/${session.code}`;
  const canStart = session.members.length >= 2;

  const handleCopy = () => {
    copyToClipboard(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      navigator.clipboard?.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    // Fix 2: exact share message from spec
    Share.share({
      message: `join my allscreens session 🎬\n\nhttps://kforgues1.github.io/allscreens/join/${session.code}`,
      url: inviteUrl,
      title: 'join my allscreens session',
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.waitingWrap}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>← back</Text>
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>waiting room</Text>

      {/* Member slots */}
      <View style={styles.memberSlots}>
        {Array.from({ length: 4 }).map((_, i) => {
          const member = session.memberProfiles[i];
          return member ? (
            <View key={i} style={styles.memberSlot}>
              <Avatar name={member.name} size={44} />
              <Text style={styles.memberName} numberOfLines={1}>{member.name.split(' ')[0]}</Text>
            </View>
          ) : (
            <View key={i} style={[styles.memberSlot, styles.memberSlotEmpty]}>
              <Text style={styles.memberPlus}>+</Text>
            </View>
          );
        })}
      </View>

      {/* Fix 2: invite pill uses live session.code from Firestore */}
      <TouchableOpacity style={styles.invitePill} onPress={handleCopy} activeOpacity={0.8}>
        <Text style={styles.inviteText}>{inviteUrl}</Text>
        <Text style={styles.copyLabel}>{copied ? 'copied!' : 'tap to copy'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryBtn} onPress={handleShare} activeOpacity={0.85}>
        <Text style={styles.secondaryBtnText}>share invite</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.primaryBtn, gradientStyle, !canStart && styles.btnDisabled, { marginTop: 12 }]}
        onPress={() => handleStart(session)}
        disabled={!canStart}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryBtnText}>
          {canStart ? 'start session' : `waiting for friends… (${session.members.length}/2)`}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Group Swipe ──────────────────────────────────────────────────────────────

function GroupSwipe({
  uid, session, onDone,
}: { uid: string; session: Session; onDone: (matched: Movie[]) => void }) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [index, setIndex] = useState(0);
  const [yesCount, setYesCount] = useState(0);
  const [matched, setMatched] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const list = await getWatchableMovies(uid);
        if (!cancelled) { setMovies(list); setLoading(false); }
      } catch {
        if (!cancelled) { setError(true); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [uid, retryCount]);

  // Watch votes in Firestore — when 3 matches found, advance
  useEffect(() => {
    if (!session.code) return;
    const unsub = onSnapshot(doc(db, 'sessions', session.code), snap => {
      const data = snap.data();
      if (data?.status === 'done' && data?.matchedMovies) {
        onDone(data.matchedMovies as Movie[]);
      }
    });
    return unsub;
  }, [session.code]);

  const vote = async (movieId: number, yes: boolean) => {
    const voteRef = doc(db, 'sessions', session.code, 'votes', uid);
    await setDoc(voteRef, { [movieId]: yes }, { merge: true });

    if (yes) {
      const newYes = yesCount + 1;
      setYesCount(newYes);
      const movie = movies[index];
      const newMatched = movie ? [...matched, movie] : matched;
      setMatched(newMatched);
      if (newYes >= 3) {
        await updateDoc(doc(db, 'sessions', session.code), {
          matchedMovies: newMatched,
          status: 'done',
        });
        onDone(newMatched);
        return;
      }
    }
    setIndex(i => i + 1);
  };

  const current = movies[index];

  if (loading) return <SwipeCardSkeleton />;
  if (error) return <DecideFetchError onRetry={() => setRetryCount(c => c + 1)} />;

  if (!current || index >= movies.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.subText}>waiting for group results…</Text>
        <ActivityIndicator color="#6D28D9" style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.swipeScroll}
      contentContainerStyle={styles.swipeWrap}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.groupBadge}>{session.code} · {session.members.length} people</Text>
      <View style={styles.swipeCard}>
        {current.posterPath ? (
          <Image
            source={{ uri: `${TMDB_IMAGE_BASE}${current.posterPath}` }}
            style={styles.swipePoster}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.swipePosterPlaceholder} />
        )}
        <View style={[styles.swipeOverlay, cardOverlayStyle]}>
          <Text style={styles.swipeTitle}>{current.title}</Text>
          <Text style={styles.swipeMeta}>{current.streamingServices?.[0] ?? '—'} · {current.year}</Text>
        </View>
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.skipBtn} onPress={() => vote(current.id, false)} activeOpacity={0.8}>
          <Text style={styles.skipIcon}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptBtn} onPress={() => vote(current.id, true)} activeOpacity={0.8}>
          <Text style={styles.acceptIcon}>✓</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Group Results ────────────────────────────────────────────────────────────

function GroupResults({
  matched, onBracket, onReset,
}: { matched: Movie[]; onBracket: () => void; onReset: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.groupResultsWrap}>
      <Text style={styles.groupResultsTitle}>you all want to watch</Text>
      {matched.map(m => (
        <View key={m.id} style={styles.matchedCard}>
          <MoviePoster posterPath={m.posterPath} width={60} height={88} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.matchedTitle}>{m.title}</Text>
            {m.streamingServices?.slice(0, 2).map(s => (
              <Text key={s} style={styles.matchedService}>{s}</Text>
            ))}
          </View>
        </View>
      ))}
      <TouchableOpacity style={[styles.primaryBtn, gradientStyle, { marginTop: 20 }]} onPress={onBracket} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>decide together</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 10 }]} onPress={onReset} activeOpacity={0.85}>
        <Text style={styles.secondaryBtnText}>start over</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DecideScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { joinCode } = useLocalSearchParams<{ joinCode?: string }>();

  const [mode, setMode] = useState<AppMode>(() => joinCode ? 'group-waiting' : 'selector');
  const [picks, setPicks] = useState<Movie[]>([]);
  const [winner, setWinner] = useState<Movie | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [groupMatched, setGroupMatched] = useState<Movie[]>([]);

  const uid = user?.uid ?? '';
  const displayName = user?.displayName ?? 'you';

  const reset = () => {
    setMode('selector');
    setPicks([]);
    setWinner(null);
    setSession(null);
    setGroupMatched([]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + 20 }]}>
      {mode === 'selector' && (
        <ModeSelector
          onSolo={() => setMode('solo-swipe')}
          onGroup={() => setMode('group-waiting')}
        />
      )}

      {mode === 'solo-swipe' && (
        <SoloSwipe
          uid={uid}
          onDone={p => { setPicks(p); setMode('solo-picks'); }}
        />
      )}

      {mode === 'solo-picks' && (
        <PicksScreen
          picks={picks}
          onPickOne={() => {
            const random = picks[Math.floor(Math.random() * picks.length)];
            if (random) { setWinner(random); setMode('solo-result'); }
          }}
          onBracket={() => setMode('solo-bracket')}
          onBack={() => setMode('solo-swipe')}
        />
      )}

      {mode === 'solo-bracket' && picks.length > 0 && (
        <BracketScreen
          initial={picks}
          onWinner={m => { setWinner(m); setMode('solo-result'); }}
        />
      )}

      {mode === 'solo-result' && winner && (
        <ResultScreen movie={winner} onReset={reset} />
      )}

      {mode === 'group-waiting' && (
        <GroupWaiting
          uid={uid}
          displayName={displayName}
          onStart={s => { setSession(s); setMode('group-swipe'); }}
          onBack={() => setMode('selector')}
          initialCode={joinCode ?? undefined}
        />
      )}

      {mode === 'group-swipe' && session && (
        <GroupSwipe
          uid={uid}
          session={session}
          onDone={m => { setGroupMatched(m); setMode('group-results'); }}
        />
      )}

      {mode === 'group-results' && (
        <GroupResults
          matched={groupMatched}
          onBracket={() => setMode('group-bracket')}
          onReset={reset}
        />
      )}

      {mode === 'group-bracket' && groupMatched.length > 0 && (
        <BracketScreen
          initial={groupMatched}
          onWinner={m => { setWinner(m); setMode('group-result'); }}
        />
      )}

      {mode === 'group-result' && winner && (
        <ResultScreen movie={winner} onReset={reset} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  loadingText: { fontSize: 13, fontWeight: '300', color: '#A78BFA' },
  subText: { fontSize: 13, fontWeight: '300', color: '#7C3AED', textAlign: 'center' },

  // Avatar
  avatar: {
    backgroundColor: '#6D28D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontWeight: '400' },

  // Poster placeholder
  posterPlaceholder: { backgroundColor: '#EDE9FE', borderRadius: 8 },

  // Mode selector
  selectorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  selectorTitle: {
    fontSize: 24, fontWeight: '200', color: '#4C1D95', letterSpacing: 4, textAlign: 'center',
  },
  selectorSub: {
    fontSize: 13, fontWeight: '300', color: '#A78BFA', textAlign: 'center', marginBottom: 8,
  },
  modeRow: { flexDirection: 'row', gap: 12 },
  modeCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#DDD6FE',
    borderRadius: 12, padding: 20, alignItems: 'center', gap: 8,
  },
  modeIconWrap: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: '#EDE9FE',
    alignItems: 'center', justifyContent: 'center',
  },
  modeLabel: { fontSize: 13, fontWeight: '500', color: '#4C1D95' },
  modeSub: { fontSize: 10, color: '#A78BFA', textAlign: 'center' },

  // Swipe
  swipeScroll: { flex: 1, backgroundColor: '#F3F0FF' },
  swipeWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 24, paddingHorizontal: 16 },
  swipeCard: {
    borderRadius: 12, overflow: 'hidden', backgroundColor: '#0A0A0F', alignSelf: 'stretch',
  },
  swipePoster: { width: '100%' as any, aspectRatio: 2 / 3, backgroundColor: '#0A0A0F' },
  swipePosterPlaceholder: { width: '100%' as any, aspectRatio: 2 / 3, backgroundColor: '#0A0A0F' },
  swipeOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '40%' as any,
    paddingTop: 24, paddingBottom: 14, paddingHorizontal: 16,
    justifyContent: 'flex-end', alignItems: 'center',
  },
  swipeTitle: { fontSize: 15, fontWeight: '500', color: '#FFFFFF', textAlign: 'center', marginBottom: 4 },
  swipeMeta: { fontSize: 11, fontWeight: '300', color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: 32, alignItems: 'center', paddingHorizontal: 24 },
  skipBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#FBEAF0', alignItems: 'center', justifyContent: 'center',
  },
  acceptBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center',
  },
  skipIcon: { fontSize: 18, color: '#E24B4A' },
  acceptIcon: { fontSize: 18, color: '#6D28D9' },
  seePicksLink: { fontSize: 13, fontWeight: '300', color: '#6D28D9', textDecorationLine: 'underline' },

  // Picks grid
  picksWrap: { flex: 1, padding: 16, gap: 8 },
  sectionTitle: {
    fontSize: 18, fontWeight: '200', color: '#4C1D95', letterSpacing: 2, marginBottom: 8,
  },
  picksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pickCard: {
    width: 140, backgroundColor: '#FFFFFF', borderWidth: 1,
    borderColor: '#DDD6FE', borderRadius: 10, padding: 8, gap: 6,
  },
  pickTitle: { fontSize: 12, fontWeight: '300', color: '#4C1D95' },
  serviceBadge: {
    alignSelf: 'flex-start', backgroundColor: '#F3F0FF',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  serviceBadgeText: { fontSize: 10, color: '#7C3AED' },

  // Result
  resultWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  resultLabel: { fontSize: 13, fontWeight: '300', color: '#A78BFA', letterSpacing: 1 },
  resultTitle: { fontSize: 20, fontWeight: '300', color: '#4C1D95', textAlign: 'center', marginTop: 4 },
  resultSub: { fontSize: 13, fontWeight: '300', color: '#A78BFA' },

  // Bracket
  bracketWrap: { flex: 1, alignItems: 'center', padding: 16, gap: 12 },
  bracketRound: { fontSize: 11, fontWeight: '300', color: '#A78BFA', letterSpacing: 1 },
  bracketRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bracketCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1,
    borderColor: '#DDD6FE', borderRadius: 12, padding: 8, alignItems: 'center', gap: 8,
  },
  bracketTitle: { fontSize: 12, fontWeight: '300', color: '#4C1D95', textAlign: 'center' },
  vsText: { fontSize: 14, fontWeight: '300', color: '#A78BFA' },

  // Group waiting
  waitingWrap: { padding: 20, gap: 16, alignItems: 'center' },
  memberSlots: { flexDirection: 'row', gap: 16, marginVertical: 8 },
  memberSlot: { alignItems: 'center', gap: 4 },
  memberSlotEmpty: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: '#DDD6FE', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  memberPlus: { fontSize: 20, color: '#DDD6FE' },
  memberName: { fontSize: 10, color: '#7C3AED', maxWidth: 50 },
  invitePill: {
    borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', gap: 2,
  },
  inviteText: { fontSize: 12, fontWeight: '300', color: '#4C1D95' },
  copyLabel: { fontSize: 10, color: '#A78BFA' },
  groupBadge: {
    fontSize: 10, color: '#A78BFA', letterSpacing: 1,
    borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },

  // Group results
  groupResultsWrap: { padding: 20, gap: 12 },
  groupResultsTitle: {
    fontSize: 16, fontWeight: '200', color: '#4C1D95', letterSpacing: 1, marginBottom: 8,
  },
  matchedCard: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 12, padding: 12,
  },
  matchedTitle: { fontSize: 14, fontWeight: '400', color: '#4C1D95', marginBottom: 4 },
  matchedService: { fontSize: 11, color: '#7C3AED' },

  // Shared buttons
  primaryBtn: {
    height: 48, borderRadius: 12, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 24, alignSelf: 'stretch',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '400', letterSpacing: 0.5 },
  secondaryBtn: {
    height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#6D28D9',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, alignSelf: 'stretch',
  },
  secondaryBtnText: { color: '#4C1D95', fontSize: 14, fontWeight: '400' },
  btnDisabled: { opacity: 0.5 },
  backBtn: { alignSelf: 'flex-start' },
  backText: { fontSize: 13, color: '#7C3AED', fontWeight: '300' },

  // Empty picks state
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  emptyIllustration: { width: 80, height: 80, borderRadius: 16, backgroundColor: '#EDE9FE' },
  emptyTitle: { fontSize: 14, fontWeight: '300', color: '#4C1D95', textAlign: 'center' },
  emptySub: { fontSize: 12, fontWeight: '300', color: '#A78BFA', textAlign: 'center', lineHeight: 18 },
  backToBrowseBtn: {
    marginTop: 8, borderWidth: 1, borderColor: '#6D28D9', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 24,
  },
  backToBrowseText: { fontSize: 13, fontWeight: '300', color: '#6D28D9' },

  // ── Skeleton ───────────────────────────────────────────────────────────────
  skeletonCard: { backgroundColor: '#EDE9FE' },
  skeletonBg: { backgroundColor: '#EDE9FE' },

  // ── Fetch error ────────────────────────────────────────────────────────────
  errorIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center',
  },
  errorTriangle: { fontSize: 18 },
  errorTitle: { fontSize: 13, fontWeight: '300', color: '#4C1D95' },
  errorRetry: { fontSize: 11, color: '#A78BFA' },

  // ── Empty queue ────────────────────────────────────────────────────────────
  emptyQueueTitle: {
    fontSize: 13, fontWeight: '300', color: '#4C1D95',
    textAlign: 'center', paddingHorizontal: 24,
  },
});
