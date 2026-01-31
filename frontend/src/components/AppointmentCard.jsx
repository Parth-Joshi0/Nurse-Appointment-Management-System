/**
 * Appointment card component for list/detail views.
 *
 * Shows appointment summary with patient info, time, status,
 * and action buttons based on status.
 */

import { format } from 'date-fns'
import {
  Clock,
  User,
  Phone,
  Calendar,
  AlertCircle,
  CheckCircle,
  ChevronRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'

// Status badge styles
const statusStyles = {
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  missed: 'bg-red-100 text-red-700 border-red-200',
  rescheduled: 'bg-amber-100 text-amber-700 border-amber-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
}

const statusIcons = {
  scheduled: Clock,
  confirmed: CheckCircle,
  completed: CheckCircle,
  missed: AlertCircle,
  rescheduled: Calendar,
  cancelled: AlertCircle,
}

// Appointment type colors
const typeColors = {
  consultation: 'border-l-blue-500',
  'follow-up': 'border-l-green-500',
  checkup: 'border-l-purple-500',
  emergency: 'border-l-red-500',
  routine: 'border-l-indigo-500',
}

/**
 * AppointmentCard component
 * @param {Object} props
 * @param {Object} props.appointment - Appointment data
 * @param {boolean} props.compact - Show compact version
 * @param {Function} props.onInitiateCall - Callback for initiating call
 * @param {Function} props.onReschedule - Callback for rescheduling
 */
export default function AppointmentCard({
  appointment,
  compact = false,
  onInitiateCall,
  onReschedule,
}) {
  const {
    id,
    patient,
    scheduled_at,
    duration_minutes = 30,
    appointment_type,
    status,
    notes,
  } = appointment

  const StatusIcon = statusIcons[status] || Clock
  const scheduledDate = new Date(scheduled_at)
  const typeColor =
    typeColors[appointment_type?.toLowerCase()] || 'border-l-gray-400'

  if (compact) {
    // Compact version for lists
    return (
      <Link
        to={`/appointments/${id}`}
        className={clsx(
          'block p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group border-l-4',
          typeColor,
        )}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-sm">
                {patient?.first_name?.[0]}
                {patient?.last_name?.[0]}
              </span>
            </div>
            <div>
              <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {patient?.first_name} {patient?.last_name}
              </p>
              <p className="text-sm text-gray-500 capitalize">
                {appointment_type}
              </p>
            </div>
          </div>
          <span
            className={clsx(
              'px-2.5 py-1 rounded-full text-xs font-medium border capitalize',
              statusStyles[status],
            )}
          >
            {status}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gray-400" />
              {format(scheduledDate, 'h:mm a')}
            </span>
            <span className="text-gray-400">•</span>
            <span>{duration_minutes} min</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
        </div>
      </Link>
    )
  }

  // Full card version
  return (
    <div
      className={clsx(
        'bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all border-l-4',
        typeColor,
      )}
    >
      {/* Status header */}
      <div
        className={clsx(
          'px-5 py-3 flex items-center gap-2 border-b',
          status === 'missed'
            ? 'bg-red-50 border-red-100'
            : status === 'completed'
              ? 'bg-green-50 border-green-100'
              : 'bg-gray-50 border-gray-100',
        )}
      >
        <StatusIcon
          className={clsx(
            'w-5 h-5',
            status === 'missed'
              ? 'text-red-500'
              : status === 'completed'
                ? 'text-green-500'
                : 'text-gray-500',
          )}
        />
        <span
          className={clsx(
            'font-medium capitalize',
            status === 'missed'
              ? 'text-red-700'
              : status === 'completed'
                ? 'text-green-700'
                : 'text-gray-700',
          )}
        >
          {status}
        </span>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Patient info */}
        <div className="flex items-start gap-4 mb-5">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-600 font-bold text-lg">
              {patient?.first_name?.[0]}
              {patient?.last_name?.[0]}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-lg text-gray-900">
              {patient?.first_name} {patient?.last_name}
            </h3>
            {patient?.phone && (
              <p className="flex items-center gap-2 text-gray-600 mt-1">
                <Phone className="w-4 h-4 text-gray-400" />
                {patient.phone}
              </p>
            )}
          </div>
        </div>

        {/* Appointment details */}
        <div className="space-y-3 mb-5 p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-3 text-gray-700">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span>{format(scheduledDate, 'EEEE, MMMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-700">
            <Clock className="w-5 h-5 text-gray-400" />
            <span>
              {format(scheduledDate, 'h:mm a')} ({duration_minutes} min)
            </span>
          </div>
          <div className="text-gray-700">
            <span className="font-medium text-gray-500">Type:</span>{' '}
            <span className="capitalize">{appointment_type}</span>
          </div>
          {notes && (
            <div className="text-gray-700">
              <span className="font-medium text-gray-500">Notes:</span> {notes}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <Link
            to={`/appointments/${id}`}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-center font-medium hover:bg-gray-200 transition-colors"
          >
            View Details
          </Link>

          {status === 'missed' && onInitiateCall && (
            <button
              onClick={() => onInitiateCall(appointment)}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              Call Patient
            </button>
          )}

          {(status === 'scheduled' || status === 'missed') && onReschedule && (
            <button
              onClick={() => onReschedule(appointment)}
              className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors shadow-sm"
            >
              Reschedule
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
