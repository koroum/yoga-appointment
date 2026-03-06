import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, addDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Navbar } from '../../components/Navbar'
import type { AvailabilityRule, Class, Slot } from '../../types'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface RuleWithClass extends AvailabilityRule {
  class: Class
}

interface RuleForm {
  day_of_week: number
  start_time: string
  class_id: string
  duration_minutes: number
  max_capacity: number
  title: string
}

const EMPTY_FORM: RuleForm = {
  day_of_week: 1,
  start_time: '09:00',
  class_id: '',
  duration_minutes: 60,
  max_capacity: 1,
  title: '',
}

export function Availability() {
  const { user } = useAuth()
  const [rules, setRules] = useState<RuleWithClass[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [overrides, setOverrides] = useState<Slot[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM)
  const [overrideDate, setOverrideDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    const [{ data: rulesData }, { data: classesData }, { data: slotsData }] = await Promise.all([
      supabase.from('availability_rules').select('*, class:classes(*)').eq('instructor_id', user!.id).eq('is_active', true).order('day_of_week'),
      supabase.from('classes').select('*').eq('instructor_id', user!.id).order('title'),
      supabase.from('slots').select('*').eq('instructor_id', user!.id).eq('status', 'unavailable').gte('starts_at', new Date().toISOString()).order('starts_at'),
    ])
    setRules((rulesData ?? []) as RuleWithClass[])
    setClasses(classesData ?? [])
    setOverrides(slotsData ?? [])
  }

  async function handleSaveRule() {
    setError(null)
    setSaving(true)
    try {
      let classId = form.class_id

      // If no existing class selected, create a new class with the given title
      if (!classId) {
        if (!form.title.trim()) throw new Error('Please select an existing class or enter a class name')
        const { data: newClass, error: classErr } = await supabase
          .from('classes')
          .insert({ instructor_id: user!.id, title: form.title.trim(), max_capacity: form.max_capacity, duration_minutes: form.duration_minutes })
          .select('id')
          .single()
        if (classErr) throw classErr
        classId = newClass.id
      }

      const { error: ruleErr } = await supabase.from('availability_rules').insert({
        instructor_id: user!.id,
        day_of_week: form.day_of_week,
        start_time: form.start_time + ':00',
        class_id: classId,
        is_active: true,
      })
      if (ruleErr) throw ruleErr

      setShowAddForm(false)
      setForm(EMPTY_FORM)
      await loadData()
      // Trigger slot generation
      await generateSlots()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save rule')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRule(id: string) {
    await supabase.from('availability_rules').update({ is_active: false }).eq('id', id)
    await loadData()
  }

  async function handleAddOverride() {
    setError(null)
    setSaving(true)
    try {
      // Create an unavailable slot for the selected date using the instructor's first class
      if (classes.length === 0) throw new Error('Create a class first before adding overrides')
      const starts = new Date(`${overrideDate}T00:00:00`)
      const ends = new Date(`${overrideDate}T23:59:59`)
      const { error: slotErr } = await supabase.from('slots').insert({
        class_id: classes[0].id,
        instructor_id: user!.id,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        status: 'unavailable',
      })
      if (slotErr) throw slotErr
      await loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add override')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveOverride(id: string) {
    await supabase.from('slots').delete().eq('id', id)
    await loadData()
  }

  async function generateSlots() {
    // Invoke generate-slots edge function
    await supabase.functions.invoke('generate-slots', { body: { instructor_id: user!.id } })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/instructor/dashboard" className="text-sm text-indigo-600">← Dashboard</Link>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Manage Availability</h1>

        {/* Recurring Schedule */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recurring Schedule</h2>

          {rules.length === 0 && !showAddForm && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center text-sm text-gray-400 mb-3">
              No recurring schedule yet
            </div>
          )}

          <div className="space-y-2">
            {rules.map(rule => (
              <div key={rule.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{DAY_NAMES[rule.day_of_week]}</p>
                  <p className="text-sm text-gray-500">{rule.start_time.slice(0, 5)} · {rule.class.title}</p>
                  <p className="text-sm text-gray-400">{rule.class.duration_minutes} min · max {rule.class.max_capacity}</p>
                </div>
                <button onClick={() => handleDeleteRule(rule.id)} className="text-red-400 hover:text-red-600 text-sm shrink-0">✕</button>
              </div>
            ))}
          </div>

          {showAddForm ? (
            <div className="bg-white rounded-xl border border-indigo-200 p-4 mt-2 space-y-3">
              <p className="font-medium text-gray-900 text-sm">New recurring slot</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Day</label>
                  <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: +e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm">
                    {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Time</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm" />
                </div>
              </div>

              {classes.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Class (existing)</label>
                  <select value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm">
                    <option value="">— create new —</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
              )}

              {!form.class_id && (
                <>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Class name</label>
                    <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Morning Flow"
                      className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Duration (min)</label>
                      <input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: +e.target.value }))}
                        min={15} max={240}
                        className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Max spots</label>
                      <input type="number" value={form.max_capacity} onChange={e => setForm(f => ({ ...f, max_capacity: +e.target.value }))}
                        min={1} max={100}
                        className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm" />
                    </div>
                  </div>
                </>
              )}

              {error && <p className="text-red-600 text-xs">{error}</p>}

              <div className="flex gap-2">
                <button onClick={handleSaveRule} disabled={saving}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM); setError(null) }}
                  className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddForm(true)}
              className="mt-2 w-full border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-600">
              + Add recurring slot
            </button>
          )}
        </div>

        {/* Date Overrides */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Override Specific Days</h2>
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Select date</label>
                <input type="date" value={overrideDate} onChange={e => setOverrideDate(e.target.value)}
                  min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <button onClick={handleAddOverride} disabled={saving}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 shrink-0">
                Mark unavailable
              </button>
            </div>
          </div>

          {overrides.length > 0 && (
            <div className="mt-2 space-y-1">
              {overrides.map(slot => (
                <div key={slot.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-100 px-4 py-2">
                  <span className="text-sm text-gray-600">✕ {format(new Date(slot.starts_at), 'MMM d, yyyy')} · Unavailable</span>
                  <button onClick={() => handleRemoveOverride(slot.id)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
