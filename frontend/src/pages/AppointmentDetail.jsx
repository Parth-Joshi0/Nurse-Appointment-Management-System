/**
 * Appointment detail page.
 *
 * Shows full appointment details with:
 * - Patient information
 * - Appointment status and history
 * - Call attempts history
 * - Actions: reschedule, cancel, initiate call
 * - Calendar sync status
 */

import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  X,
  Edit,
  Trash2,
} from 'lucide-react'
import {
  getAppointment,
  rescheduleAppointment,
  cancelAppointment,
  initiateCall,
  syncToCalendar,
  getCalendarSyncStatus,
} from '../api/client'
import { useState } from 'react'

export default function AppointmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showReschedule, setShowReschedule] = useState(false)
  const [newDateTime, setNewDateTime] = useState('')
  const [rescheduleReason, setRescheduleReason] = useState('')

  // Fetch appointment
  const {
    data: appointment,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['appointments', id],
    queryFn: () => getAppointment(id),
    enabled: !!id,
  })

  // Fetch calendar sync status
  const { data: syncStatus } = useQuery({
    queryKey: ['calendar-sync', id],
    queryFn: () => getCalendarSyncStatus(id),
    enabled: !!id,
  })

  // Reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: ({ newDatetime, reason }) =>
      rescheduleAppointment(id, newDatetime, reason),
    onSuccess: () => {
      queryClient.invalidateQueries(['appointments', id])
      setShowReschedule(false)
    },
  })

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: () => cancelAppointment(id),
    onSuccess: () => {
      navigate('/')
    },
  })

  // Call mutation
  const callMutation = useMutation({
    mutationFn: () =>
      initiateCall(id, appointment.patient_id || appointment.patient?.id),
    onSuccess: () => {
      queryClient.invalidateQueries(['appointments', id])
    },
  })

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: () => syncToCalendar(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['calendar-sync', id])
      queryClient.invalidateQueries(['appointments', id])
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-500">Loading appointment...</p>
        </div>
      </div>
    )
  }

  if (error || !appointment) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Appointment not found
        </h2>
        <p className="text-gray-500 mb-4">
          The appointment you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Dashboard
        </Link>
      </div>
    )
  }

  const {
    patient,
    scheduled_at,
    duration_minutes,
    appointment_type,
    status,
    notes,
  } = appointment
  const scheduledDate = new Date(scheduled_at)

  const statusColors = {
    scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
    confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
    completed: 'bg-green-100 text-green-700 border-green-200',
    missed: 'bg-red-100 text-red-700 border-red-200',
    rescheduled: 'bg-amber-100 text-amber-700 border-amber-200',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  }

  const handleReschedule = () => {
    if (!newDateTime) return
    rescheduleMutation.mutate({
      newDatetime: new Date(newDateTime).toISOString(),
      reason: rescheduleReason || null,
    })
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 mb-6 font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* Main card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Status header */}
        <div
          className={`
            px-6 py-4 flex items-center justify-between border-b
            ${
              status === 'missed'
                ? 'bg-gradient-to-r from-red-50 to-white border-red-100'
                : status === 'completed'
                  ? 'bg-gradient-to-r from-green-50 to-white border-green-100'
                  : 'bg-gradient-to-r from-gray-50 to-white border-gray-100'
            }
          `}
        >
          <div className="flex items-center gap-3">
            <div
              className={`
              w-10 h-10 rounded-xl flex items-center justify-center
              ${status === 'completed' ? 'bg-green-100' : status === 'missed' ? 'bg-red-100' : 'bg-blue-100'}
            `}
            >
              {status === 'completed' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : status === 'missed' ? (
                <AlertCircle className="w-5 h-5 text-red-600" />
              ) : (
                <Clock className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <span
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border capitalize ${statusColors[status]}`}
            >
              {status}
            </span>
          </div>

          {/* Calendar sync status */}
          <div className="flex items-center gap-3">
            {syncStatus?.synced ? (
              <span className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-xl">
                <CheckCircle className="w-4 h-4" />
                Synced to Calendar
              </span>
            ) : (
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl transition-colors"
              >
                <RefreshCw
                  className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`}
                />
                Sync to Calendar
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Patient info */}
            <div className="bg-gray-50 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-gray-400" />
                Patient Information
              </h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-xl">
                      {patient?.first_name?.[0]}
                      {patient?.last_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-gray-900">
                      {patient?.first_name} {patient?.last_name}
                    </p>
                    <p className="text-gray-500">Patient</p>
                  </div>
                </div>

                {patient?.phone && (
                  <div className="flex items-center gap-3 text-gray-600 p-3 bg-white rounded-xl">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <a
                      href={`tel:${patient.phone}`}
                      className="hover:text-blue-600 transition-colors"
                    >
                      {patient.phone}
                    </a>
                  </div>
                )}

                {patient?.email && (
                  <div className="flex items-center gap-3 text-gray-600 p-3 bg-white rounded-xl">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <a
                      href={`mailto:${patient.email}`}
                      className="hover:text-blue-600 transition-colors"
                    >
                      {patient.email}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Appointment details */}
            <div className="bg-gray-50 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-400" />
                Appointment Details
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-700 p-3 bg-white rounded-xl">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span>{format(scheduledDate, 'EEEE, MMMM d, yyyy')}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-700 p-3 bg-white rounded-xl">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <span>
                    {format(scheduledDate, 'h:mm a')} ({duration_minutes} min)
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl">
                  <span className="text-gray-500 text-sm">Type</span>
                  <p className="font-medium text-gray-900 capitalize">
                    {appointment_type}
                  </p>
                </div>
                {notes && (
                  <div className="p-3 bg-white rounded-xl">
                    <span className="text-gray-500 text-sm">Notes</span>
                    <p className="text-gray-700 mt-1">{notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reschedule form */}
          {showReschedule && (
            <div className="mt-6 p-5 bg-gradient-to-r from-amber-50 to-white rounded-2xl border border-amber-200">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" />
                Reschedule Appointment
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={newDateTime}
                    onChange={(e) => setNewDateTime(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason (optional)
                  </label>
                  <input
                    type="text"
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    placeholder="e.g., Patient requested new time"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all outline-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleReschedule}
                    disabled={!newDateTime || rescheduleMutation.isPending}
                    className="px-5 py-2.5 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {rescheduleMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      'Confirm Reschedule'
                    )}
                  </button>
                  <button
                    onClick={() => setShowReschedule(false)}
                    className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap gap-3">
            {status === 'missed' && (
              <button
                onClick={() => callMutation.mutate()}
                disabled={callMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                <Phone className="w-4 h-4" />
                {callMutation.isPending ? 'Initiating...' : 'Call Patient'}
              </button>
            )}

            {(status === 'scheduled' || status === 'missed') &&
              !showReschedule && (
                <button
                  onClick={() => setShowReschedule(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors shadow-sm"
                >
                  <Edit className="w-4 h-4" />
                  Reschedule
                </button>
              )}

            {status !== 'cancelled' && status !== 'completed' && (
              <button
                onClick={() => {
                  if (
                    confirm('Are you sure you want to cancel this appointment?')
                  ) {
                    cancelMutation.mutate()
                  }
                }}
                disabled={cancelMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-100 text-red-700 rounded-xl font-medium hover:bg-red-200 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Cancel Appointment
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
