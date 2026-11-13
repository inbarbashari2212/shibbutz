import {
  Check,
  Copy,
  Download,
  MessageCircle,
  Printer,
  Share2,
  Upload,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { ScheduleState } from '../types/schedule';
import {
  encodeScheduleToShareUrl,
  isValidScheduleState,
} from '../utils/share';

interface ShareModalProps {
  state: ScheduleState;
  onClose: () => void;
  onImportState: (imported: ScheduleState) => void;
}

export function ShareModal({
  state,
  onClose,
  onImportState,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shareUrl = encodeScheduleToShareUrl(state);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback prompt
      window.prompt('העתיקו את הקישור לשיתוף:', shareUrl);
    }
  };

  const handleWhatsAppShare = () => {
    const text = `היי! עדכנתי את מערכת הטיפולים השבועית בגן התקשורת (${state.sessions.length} מפגשים). אפשר לפתוח ולערוך מכאן:\n${shareUrl}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shibbutz-gan-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!isValidScheduleState(parsed)) {
        setImportError('הקובץ אינו בפורמט תקין של מערכת השיבוץ.');
        return;
      }
      onImportState(parsed);
      onClose();
    } catch {
      setImportError('לא ניתן היה לקרוא את הקובץ. ודאו שזהו קובץ JSON תקין.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet-up sm:animate-modal-pop w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-extrabold text-slate-900">
              שיתוף לצוות, הדפסה וגיבוי
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-3.5">
            <h3 className="text-xs font-extrabold text-teal-950">
              שליחת הלוח המעודכן לענבר, יעל ושירלי
            </h3>
            <p className="mt-1 text-xs text-teal-900/80">
              כל השינויים שלכן מקודדים ישירות בתוך הקישור! שלחו את הקישור
              בוואטסאפ כדי שכל אחת תוכל לפתוח בטלפון או במחשב עם הלוח העדכני ביותר.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-teal-700"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>הקישור הועתק!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>העתק קישור שיתוף</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" />
                <span>שלח בוואטסאפ</span>
              </button>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                setTimeout(() => window.print(), 150);
              }}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
            >
              <Printer className="h-5 w-5 text-slate-600" />
              <span>הדפסה / PDF</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
            >
              <Download className="h-5 w-5 text-slate-600" />
              <span>שמור קובץ גיבוי</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
            >
              <Upload className="h-5 w-5 text-slate-600" />
              <span>טען קובץ גיבוי</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>

          {importError && (
            <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {importError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
