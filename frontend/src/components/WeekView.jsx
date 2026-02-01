import { format, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns'
import ViewSwitcher from './ViewSwitcher'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function WeekView({
  appointments = [],
  selectedDate,
  onDateSelect,
  onAddAppointment,
  onEditAppointment,
  onViewModeChange,
  viewMode
}) {
  const weekStart = startOfWeek(selectedDate)
  const weekEnd = endOfWeek(selectedDate)
  const days = []
  for (let i = 0; i < 7; i++) {
    days.push(addDays(weekStart, i))
  }

  const getAppointmentsForDay = (date) => {
    return appointments.filter(apt => {
      const aptDate = apt.scheduled_date
      return aptDate && isSameDay(new Date(aptDate), date)
    })
  }

  const getAppointmentColor = (type) => {
    const colors = {
      'consultation': 'bg-blue-100 text-blue-800 border-blue-200',
      'follow-up': 'bg-green-100 text-green-800 border-green-200',
      'check-up': 'bg-purple-100 text-purple-800 border-purple-200',
      'vaccination': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'treatment': 'bg-pink-100 text-pink-800 border-pink-200',
      'emergency': 'bg-red-100 text-red-800 border-red-200',
    }
    return colors[type?.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const handlePrevWeek = () => {
    onDateSelect(addDays(weekStart, -7))
  }
  const handleNextWeek = () => {
    onDateSelect(addDays(weekStart, 7))
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <button onClick={handlePrevWeek} className="p-2 rounded hover:bg-gray-100">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold">Week of {format(weekStart, 'MMM d, yyyy')}</h2>
          <button onClick={handleNextWeek} className="p-2 rounded hover:bg-gray-100">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <ViewSwitcher currentView={viewMode} onViewChange={onViewModeChange} />
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={() => onAddAppointment(weekStart)}
          >
            + Add Appointment
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map(day => (
          <div
            key={day.toISOString()}
            className={`border rounded p-2 cursor-pointer hover:bg-blue-50 ${isSameDay(day, selectedDate) ? 'bg-blue-100 border-blue-500' : ''}`}
            onClick={() => onDateSelect(day)}
          >
            <div className="font-semibold text-center">{format(day, 'EEE d')}</div>
            <ul className="mt-2 space-y-1">
              {getAppointmentsForDay(day)
                .sort((a, b) => {
                  const timeA = a.scheduled_date ? format(new Date(a.scheduled_date), 'HH:mm') : ''
                  const timeB = b.scheduled_date ? format(new Date(b.scheduled_date), 'HH:mm') : ''
                  return timeA.localeCompare(timeB)
                })
                .map(apt => {
                  const time = apt.scheduled_date ? format(new Date(apt.scheduled_date), 'HH:mm') : ''
                  return (
                    <li
                      key={apt.id}
                      className={`text-xs px-2 py-1 rounded truncate cursor-pointer border ${getAppointmentColor(apt.specialist_type)} hover:opacity-80 transition-opacity`}
                      onClick={e => {
                        e.stopPropagation();
                        onEditAppointment && onEditAppointment(apt)
                      }}
                    >
                      <div className="font-semibold">{time}</div>
                      <div className="truncate">{apt.patient_name || 'Appointment'}</div>
                    </li>
                  )
                })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
