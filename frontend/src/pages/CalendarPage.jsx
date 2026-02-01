/**
 * Calendar Page with all calendar views.
 * 
 * Features:
 * - Day, Week, Month view switching
 * - Add/Edit appointments via modal
 * - Appointment side panel for details
 * - Full backend API integration
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from 'date-fns'
import { RefreshCw } from 'lucide-react'
import MonthCalendar from '../components/MonthCalendar'
import DayView from '../components/DayView'
import WeekView from '../components/WeekView'
import AppointmentModal from '../components/AppointmentModal'
import AppointmentSidePanel from '../components/AppointmentSidePanel'
import {
  getReferralsByDate,
  createReferral,
  updateReferral,
  initiateCall,
} from '../api/client'

export default function CalendarPage() {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('month')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState(null)
  const [selectedAppointment, setSelectedAppointment] = useState(null)

  // Fetch appointments for the current view range
  const getDateRange = () => {
    if (viewMode === 'month') {
      const start = startOfMonth(selectedDate)
      const end = endOfMonth(selectedDate)
      return { start, end }
    } else if (viewMode === 'week') {
      const start = startOfWeek(selectedDate)
      const end = endOfWeek(selectedDate)
      return { start, end }
    }
    return { start: selectedDate, end: selectedDate }
  }

  const { start, end } = getDateRange()
  
  // Fetch all referrals for the date range with parallel requests
  const { data: appointments = [], isLoading, isFetching } = useQuery({
    queryKey: ['referrals', 'range', format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')],
    queryFn: async () => {
      const dates = []
      let currentDate = start
      while (currentDate <= end) {
        dates.push(format(currentDate, 'yyyy-MM-dd'))
        currentDate = addDays(currentDate, 1)
      }

      // Fetch all dates in parallel instead of sequentially
      const results = await Promise.allSettled(
        dates.map(date => getReferralsByDate(date))
      )

      const allReferrals = []
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          allReferrals.push(...(result.value || []))
        }
      })

      return allReferrals
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - keep data fresh longer
    cacheTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false, // Use cached data on mount if available
  })

  // Create referral mutation
  const createMutation = useMutation({
    mutationFn: (data) => {
      // Get user ID from localStorage
      const userId = localStorage.getItem('user_id') || '12345678-1234-5678-1234-567812345678'
      const payload = {
        patient_name: data.patient_name,
        patient_dob: data.patient_dob,
        health_card_number: data.health_card_number,
        patient_phone: data.patient_phone || '',
        patient_email: data.patient_email,
        condition: data.condition,
        specialist_type: data.specialist_type,
        scheduled_date: `${data.scheduled_date}T09:00:00Z`,
        notes: data.notes || '',
        created_by_id: userId,
        referral_date: new Date().toISOString().split('T')[0],
        urgency: 'ROUTINE',
        is_high_risk: false,
      }
      console.log('Creating referral with payload:', payload)
      return createReferral(payload)
    },
    onSuccess: () => {
      // Only invalidate the specific date range query
      queryClient.invalidateQueries({
        queryKey: ['referrals', 'range'],
      })
      setIsModalOpen(false)
    },
    onError: (error) => {
      console.error('Error creating referral:', error)
      console.error('Error response:', error.response?.data)
      alert(`Error creating referral: ${error.response?.data?.detail || error.message}`)
    },
  })

  // Update referral mutation  
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => updateReferral(id, data),
    onSuccess: () => {
      // Only invalidate the specific date range query
      queryClient.invalidateQueries({
        queryKey: ['referrals', 'range'],
      })
      setIsModalOpen(false)
      setEditingAppointment(null)
    },
  })

  // Initiate call mutation
  const callMutation = useMutation({
    mutationFn: (referralId) => {
      const referral = appointments.find(a => a.id === referralId)
      return initiateCall(referral)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey || [];
        return (
          key[0] === 'referrals'
        );
      }});
      setSelectedAppointment(null)
    },
  })

  const handleAddAppointment = () => {
    setEditingAppointment(null)
    setIsModalOpen(true)
  }

  const handleEditAppointment = (appointment) => {
    setSelectedAppointment(appointment)
  }

  const handleSaveAppointment = (appointmentData) => {
    if (editingAppointment) {
      updateMutation.mutate({ id: editingAppointment.id, ...appointmentData })
    } else {
      createMutation.mutate(appointmentData)
    }
  }

  const handleTriggerAgentCall = (appointmentId) => {
    callMutation.mutate(appointmentId)
  }

  const handleCallManually = (referralId) => {
    const referral = appointments.find(a => a.id === referralId)
    const phone = referral?.patient_phone
    if (phone) {
      window.open(`tel:${phone}`, '_self')
    } else {
      alert('No phone number available for this patient')
    }
    setSelectedAppointment(null)
  }

  const renderCalendarView = () => {
    switch (viewMode) {
      case 'day':
        return (
          <DayView
            appointments={appointments}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            onAddAppointment={handleAddAppointment}
            onEditAppointment={handleEditAppointment}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        )
      case 'week':
        return (
          <WeekView
            appointments={appointments}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            onAddAppointment={handleAddAppointment}
            onEditAppointment={handleEditAppointment}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        )
      case 'month':
      default:
        return (
          <MonthCalendar
            appointments={appointments}
            selectedDate={selectedDate}
            onDateSelect={(date) => {
              setSelectedDate(date)
              setViewMode('day')
            }}
            onMonthChange={setSelectedDate}
            onAddAppointment={handleAddAppointment}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        )
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Referral Appointments</h1>
          <p className="text-gray-600 mt-2">Manage and track all patient referral appointments</p>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries(['referrals'])}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        renderCalendarView()
      )}

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingAppointment(null)
        }}
        onSave={handleSaveAppointment}
        appointment={editingAppointment}
        selectedDate={selectedDate}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {selectedAppointment && (
        <AppointmentSidePanel
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onTriggerAgentCall={handleTriggerAgentCall}
          onCallManually={handleCallManually}
        />
      )}
    </div>
  )
}
