import { formatInNY } from '../utils/dates'

interface Props {
  nextSlotDate?: Date | null
}

export function EmptyState({ nextSlotDate }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-gray-500">
      <div className="text-4xl mb-3">🧘</div>
      {nextSlotDate ? (
        <>
          <p className="font-medium text-gray-700">Next class available</p>
          <p className="text-sm mt-1">{formatInNY(nextSlotDate, 'EEEE, MMM d · h:mm a')}</p>
        </>
      ) : (
        <>
          <p className="font-medium text-gray-700">No classes scheduled yet</p>
          <p className="text-sm mt-1">Check back soon</p>
        </>
      )}
    </div>
  )
}
