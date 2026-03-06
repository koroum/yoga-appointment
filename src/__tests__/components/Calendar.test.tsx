import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Calendar, type DayStatus } from '../../components/Calendar'

describe('Calendar', () => {
  it('renders current month name and year', () => {
    render(<Calendar />)
    const now = new Date()
    const monthName = now.toLocaleString('en-US', { month: 'long' })
    const year = now.getFullYear().toString()
    expect(screen.getByText(new RegExp(`${monthName}\\s+${year}`))).toBeInTheDocument()
  })

  it('starts week from Sunday', () => {
    render(<Calendar />)
    const headers = screen.getAllByText(/^(Su|Mo|Tu|We|Th|Fr|Sa)$/)
    expect(headers[0].textContent).toBe('Su')
    expect(headers[6].textContent).toBe('Sa')
  })

  it('renders day numbers for current month', () => {
    render(<Calendar />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('highlights today with indigo styling', () => {
    render(<Calendar />)
    const today = new Date().getDate().toString()
    const todayEl = screen.getByText(today, { exact: true })
    expect(todayEl.className).toMatch(/indigo/)
  })

  it('calls onSelectDate when a day is clicked', async () => {
    const onSelect = vi.fn()
    render(<Calendar onSelectDate={onSelect} />)

    await userEvent.click(screen.getByText('15'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    const calledDate = onSelect.mock.calls[0][0] as Date
    expect(calledDate.getDate()).toBe(15)
  })

  it('shows colored dot for marked days', () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const key = `${year}-${month}-15`
    const markedDays: Record<string, DayStatus> = { [key]: 'available' }

    render(<Calendar markedDays={markedDays} />)

    // The 15th should have a green dot child
    const dayButton = screen.getByText('15').closest('button')
    const dot = dayButton?.querySelector('.bg-green-500')
    expect(dot).toBeTruthy()
  })

  it('navigates to next month', async () => {
    render(<Calendar />)
    const nextBtn = screen.getByText('►')
    await userEvent.click(nextBtn)

    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    const monthName = nextMonth.toLocaleString('en-US', { month: 'long' })
    expect(screen.getByText(new RegExp(monthName))).toBeInTheDocument()
  })

  it('navigates to previous month', async () => {
    render(<Calendar />)
    const prevBtn = screen.getByText('◄')
    await userEvent.click(prevBtn)

    const prevMonth = new Date()
    prevMonth.setMonth(prevMonth.getMonth() - 1)
    const monthName = prevMonth.toLocaleString('en-US', { month: 'long' })
    expect(screen.getByText(new RegExp(monthName))).toBeInTheDocument()
  })

  it('renders legend with status labels', () => {
    render(<Calendar />)
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })
})
