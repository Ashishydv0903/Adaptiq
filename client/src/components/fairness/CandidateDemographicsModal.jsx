import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Shield, CheckCircle2, Lock, X, AlertCircle } from 'lucide-react';

export const CandidateDemographicsModal = ({ isOpen, onClose }) => {
  const [gender, setGender] = useState('prefer_not_to_say');
  const [ethnicity, setEthnicity] = useState('prefer_not_to_say');
  const [ageGroup, setAgeGroup] = useState('prefer_not_to_say');
  const [disabilityStatus, setDisabilityStatus] = useState('prefer_not_to_say');
  const [veteranStatus, setVeteranStatus] = useState('prefer_not_to_say');
  const [consentGiven, setConsentGiven] = useState(true);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Fetch existing demographics if available
      api
        .get('/fairness/demographics/my')
        .then((res) => {
          const d = res.data?.data?.demographics;
          if (d) {
            setGender(d.gender || 'prefer_not_to_say');
            setEthnicity(d.ethnicity || 'prefer_not_to_say');
            setAgeGroup(d.ageGroup || 'prefer_not_to_say');
            setDisabilityStatus(d.disabilityStatus || 'prefer_not_to_say');
            setVeteranStatus(d.veteranStatus || 'prefer_not_to_say');
            setConsentGiven(Boolean(d.consentGiven));
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await api.post('/fairness/demographics/my', {
        gender,
        ethnicity,
        ageGroup,
        disabilityStatus,
        veteranStatus,
        consentGiven
      });

      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update confidential demographics.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Confidential Demographics</h3>
              <p className="text-[11px] text-slate-400">Used strictly for algorithmic bias audits.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Privacy Callout */}
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 flex items-start gap-2">
          <Lock className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-slate-300">
            <strong>Strict Confidentiality:</strong> Demographic information is stored in an isolated collection. It is <strong>never</strong> exposed to interviewers or scoring models during assessments.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Gender Identity</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="prefer_not_to_say">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="non_binary">Non-binary</option>
                <option value="transgender">Transgender</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Race / Ethnicity</label>
              <select
                value={ethnicity}
                onChange={(e) => setEthnicity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="prefer_not_to_say">Prefer not to say</option>
                <option value="asian">Asian</option>
                <option value="black">Black / African American</option>
                <option value="hispanic_latino">Hispanic / Latino</option>
                <option value="white">White / Caucasian</option>
                <option value="indigenous">Indigenous / Native American</option>
                <option value="middle_eastern">Middle Eastern</option>
                <option value="multiracial">Multiracial</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Age Range</label>
              <select
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="prefer_not_to_say">Prefer not to say</option>
                <option value="18-24">18 - 24</option>
                <option value="25-34">25 - 34</option>
                <option value="35-44">35 - 44</option>
                <option value="45-54">45 - 54</option>
                <option value="55+">55+</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Disability Status</label>
              <select
                value={disabilityStatus}
                onChange={(e) => setDisabilityStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="prefer_not_to_say">Prefer not to say</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="consent"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800 focus:ring-0 cursor-pointer"
            />
            <label htmlFor="consent" className="text-[11px] text-slate-300 cursor-pointer">
              I consent to anonymized demographic inclusion for algorithmic bias audits.
            </label>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Demographics confidentially saved.</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-md transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Demographics'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CandidateDemographicsModal;