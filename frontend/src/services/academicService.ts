import api from './api'

export const academicService = {
  // Dashboard & Status
  async getDashboard(schoolId: number | string, params?: any): Promise<any> {
    const res = await api.get(`/academic-admin/dashboard/${schoolId}`, { params })
    return res.data
  },

  async getActivePeriodInfo(params?: { schoolId?: number | string; yearId?: number | string }): Promise<any> {
    const res = await api.get('/academic-admin/active-period-info', { params })
    return res.data
  },

  // General Settings


  async getSettings(schoolId: number | string, params?: any): Promise<any> {

    const res = await api.get(`/academic-admin/settings/${schoolId}`, { params })
    return res.data
  },

  // Academic Years
  async createYear(payload: any): Promise<any> {
    const res = await api.post('/academic-admin/settings/years', payload)
    return res.data
  },

  async updateYearStatus(yearId: number | string, payload: any): Promise<any> {
    const res = await api.patch(`/academic-admin/settings/years/${yearId}/status`, payload)
    return res.data
  },

  async updateYearCalendarType(yearId: number | string, payload: any): Promise<any> {
    const res = await api.patch(`/academic-admin/settings/years/${yearId}/calendar-type`, payload)
    return res.data
  },

  async deleteYear(yearId: number | string, schoolId: number | string): Promise<any> {
    const res = await api.delete(`/academic-admin/settings/years/${yearId}`, { params: { schoolId } })
    return res.data
  },

  // Periods Management
  async getPeriods(schoolId?: number | string, yearId?: number | string): Promise<any[]> {
    const params: any = {}
    if (schoolId) params.schoolId = schoolId
    if (yearId) params.yearId = yearId
    const res = await api.get('/periodos', { params })
    return res.data?.data || res.data || []
  },

  async createPeriod(payload: any): Promise<any> {
    const res = await api.post('/periodos', payload)
    return res.data
  },

  async createSettingPeriod(payload: any): Promise<any> {
    const res = await api.post('/academic-admin/settings/periods', payload)
    return res.data
  },

  async updatePeriodPercentage(periodId: number | string, payload: any): Promise<any> {
    const res = await api.patch(`/academic-admin/settings/periods/${periodId}/percentage`, payload)
    return res.data
  },

  async approvePeriod(periodId: number | string, schoolId: number | string): Promise<any> {
    const res = await api.post(`/academic-admin/settings/periods/${periodId}/approve`, { schoolId })
    return res.data
  },

  async closePeriod(periodId: number | string, schoolId: number | string, force = false): Promise<any> {
    const res = await api.post(`/academic-admin/settings/periods/${periodId}/close`, { schoolId, force })
    return res.data
  },

  async reopenPeriod(periodId: number | string, schoolId: number | string): Promise<any> {
    const res = await api.post(`/academic-admin/settings/periods/${periodId}/reopen`, { schoolId })
    return res.data
  },

  async deleteSettingPeriod(periodId: number | string, schoolId: number | string): Promise<any> {
    const res = await api.delete(`/academic-admin/settings/periods/${periodId}`, { data: { schoolId } })
    return res.data
  },

  async updatePeriod(id: number | string, payload: any): Promise<any> {
    const res = await api.put(`/periodos/${id}`, payload)
    return res.data
  },

  async deletePeriod(id: number | string): Promise<any> {
    const res = await api.delete(`/periodos/${id}`)
    return res.data
  },

  // Enrollment Dates & Config
  async getEnrollmentDates(schoolId: number | string): Promise<any> {
    const res = await api.get(`/academic-admin/settings/enrollment-dates/${schoolId}`)
    return res.data
  },

  async saveEnrollmentDates(schoolId: number | string, payload: any): Promise<any> {
    const res = await api.post(`/academic-admin/settings/enrollment-dates/${schoolId}`, payload)
    return res.data
  },

  async getEnrollmentConfig(schoolId: number | string, yearId: number | string): Promise<any> {
    const res = await api.get(`/academic-admin/settings/enrollment-config/${schoolId}/${yearId}`)
    return res.data
  },

  async saveEnrollmentConfig(payload: any): Promise<any> {
    const res = await api.post('/academic-admin/settings/enrollment-config', payload)
    return res.data
  },


  // Scales
  async getScales(schoolId?: number | string): Promise<any[]> {
    const params = schoolId ? { schoolId } : {}
    const res = await api.get('/academic-scales', { params })
    return res.data?.data || res.data || []
  },

  async saveScales(payload: any): Promise<any> {
    const res = await api.post('/academic-scales', payload)
    return res.data
  },

  async updateDefaultScales(payload: any): Promise<any> {
    const res = await api.put('/academic-admin/settings/defaults', payload)
    return res.data
  },

  async updateManualScales(payload: any): Promise<any> {
    const res = await api.put('/academic-admin/settings/scales/manual', payload)
    return res.data
  },

  // Catalogs & Grades
  async getCatalogs(): Promise<any> {
    const res = await api.get('/academic-admin/catalogs')
    return res.data
  },

  async getGradesAndGroups(schoolId: number | string, params?: any): Promise<any> {
    const res = await api.get(`/academic-admin/grades/${schoolId}`, { params })
    return res.data
  },

  async createGradeType(payload: any): Promise<any> {
    const res = await api.post('/academic-admin/grade-types', payload)
    return res.data
  },

  async deleteGradeType(id: number | string, schoolId: number | string): Promise<any> {
    const res = await api.delete(`/academic-admin/grade-types/${id}`, { params: { schoolId } })
    return res.data
  },

  async createGroup(payload: any): Promise<any> {
    const res = await api.post('/academic-admin/groups', payload)
    return res.data
  },

  async deleteGroup(id: number | string, schoolId: number | string): Promise<any> {
    const res = await api.delete(`/academic-admin/groups/${id}`, { params: { schoolId } })
    return res.data
  },

  async getCourseMembers(groupId: number | string, schoolId: number | string, yearId?: number): Promise<any> {
    const params: any = { schoolId }
    if (yearId) params.yearId = yearId
    const res = await api.get(`/academic-admin/groups/${groupId}/members`, { params })
    return res.data
  },

  async reassignGroupJornada(groupId: number | string, payload: any): Promise<any> {
    const res = await api.patch(`/academic-admin/groups/${groupId}/jornada`, payload)
    return res.data
  },

  async updateGroupCupos(id: number | string, payload: any): Promise<any> {
    const res = await api.patch(`/academic-admin/groups/${id}/cupos`, payload)
    return res.data
  },

  async renameGroup(id: number | string, payload: any): Promise<any> {
    const res = await api.patch(`/academic-admin/groups/${id}/rename`, payload)
    return res.data
  },

  async bulkRenameGroups(idTipoGrado: number | string, payload: any): Promise<any> {
    const res = await api.patch(`/academic-admin/grade-types/${idTipoGrado}/bulk-rename`, payload)
    return res.data
  },

  // Jornadas
  async createJornada(payload: any): Promise<any> {
    const res = await api.post('/academic-admin/jornadas', payload)
    return res.data
  },

  async deleteJornada(id: number | string, schoolId: number | string): Promise<any> {
    const res = await api.delete(`/academic-admin/jornadas/${id}`, { params: { schoolId } })
    return res.data
  },

  async reassignJornada(payload: any): Promise<any> {
    const res = await api.post('/academic-admin/jornadas/reassign', payload)
    return res.data
  },

  // Subjects Management
  async getSubjects(schoolId: number | string, params?: any): Promise<any[]> {
    const res = await api.get(`/academic-admin/subjects/${schoolId}`, { params })
    return res.data || []
  },

  async getTrashSubjects(schoolId: number | string, params?: any): Promise<any[]> {
    const res = await api.get(`/academic-admin/subjects/trash/${schoolId}`, { params })
    return res.data || []
  },

  async createSubject(payload: any): Promise<any> {
    const res = await api.post('/academic-admin/subjects', payload)
    return res.data
  },

  async deleteSubject(id: number | string, schoolId: number | string, force = false): Promise<any> {
    const res = await api.delete(`/academic-admin/subjects/${id}`, { params: { schoolId, force } })
    return res.data
  },

  async restoreSubjectFromTrash(id: number | string, schoolId: number | string): Promise<any> {
    const res = await api.post(`/academic-admin/subjects/trash/${id}/restore`, { schoolId })
    return res.data
  },

  async getSubjectImpact(id: number | string, schoolId: number | string): Promise<any> {
    const res = await api.get(`/academic-admin/subjects/${id}/impact`, { params: { schoolId } })
    return res.data
  },

  async getSubjectDetails(id: number | string): Promise<any> {
    const res = await api.get(`/academic-admin/subjects/${id}`)
    return res.data
  },

  async getSubjectCurriculumDetails(id: number | string, schoolId?: number | string, yearId?: number | string): Promise<any> {
    const params: any = {}
    if (schoolId) params.schoolId = schoolId
    if (yearId) params.yearId = yearId
    const res = await api.get(`/academic-admin/subjects/${id}/curriculum-details`, { params })
    return res.data
  },


  // Competencies & DBAs
  async getDbaPlaneacionDisponibles(schoolId: number | string, params?: any): Promise<any[]> {
    const res = await api.get(`/academic-admin/settings/dba-planeacion/disponibles/${schoolId}`, { params })
    return res.data || []
  },

  async checkCompetencyUsage(competenciaId: number | string, schoolId: number | string): Promise<any> {
    const res = await api.get(`/academic-admin/settings/competencies/${competenciaId}/usage-check`, { params: { schoolId } })
    return res.data
  },

  async saveCompetency(payload: any): Promise<any> {
    const res = await api.post('/academic-admin/settings/competencies', payload)
    return res.data
  },

  async deleteCompetency(id: number | string, schoolId?: number | string): Promise<any> {
    const res = await api.delete(`/academic-admin/settings/competencies/${id}`, { data: { schoolId } })
    return res.data
  },

  async createCurriculumEvidence(competenciaId: number | string, payload: any): Promise<any> {
    const res = await api.post(`/academic-admin/settings/competencies/${competenciaId}/evidencias`, payload)
    return res.data
  },

  async updateCurriculumEvidence(id: number | string, payload: any): Promise<any> {
    const res = await api.put(`/academic-admin/settings/evidencias/${id}`, payload)
    return res.data
  },

  async deleteCurriculumEvidence(id: number | string, schoolId?: number | string): Promise<any> {
    const res = await api.delete(`/academic-admin/settings/evidencias/${id}`, { data: { schoolId } })
    return res.data
  },

  async linkDbaEvidences(competenciaId: number | string, payload: any): Promise<any> {
    const res = await api.post(`/academic-admin/settings/competencias/${competenciaId}/vincular-evidencias-dba`, payload)
    return res.data
  },

  // Academic Tracking & Consolidation
  async getPeriodTracking(params?: any): Promise<any> {
    const res = await api.get('/academic-admin/academic-tracking/period-tracking', { params })
    return res.data
  },

  async getAnnualConsolidation(params?: any): Promise<any> {
    const res = await api.get('/academic-admin/academic-tracking/annual-consolidation', { params })
    return res.data
  },

  async checkAcademicWarning(params?: any): Promise<any> {
    const res = await api.get('/academic-admin/academic-tracking/check-warning', { params })
    return res.data
  },

  async getStudentTrackingHistory(studentId: number | string, params?: any): Promise<any> {
    const res = await api.get(`/academic-admin/academic-tracking/student-history/${studentId}`, { params })
    return res.data
  },

  async recordPromotionDecision(payload: any): Promise<any> {
    const res = await api.post('/academic-admin/academic-tracking/record-decision', payload)
    return res.data
  },

  // School Identity (MySchool)
  async getMySchool(schoolId: number | string): Promise<any> {
    const res = await api.get(`/academic-admin/my-school/${schoolId}`)
    return res.data
  },

  async updateSchoolIdentity(schoolId: number | string, payload: any): Promise<any> {
    const res = await api.put(`/academic-admin/my-school/${schoolId}/identidad`, payload)
    return res.data
  },

  async uploadSchoolEscudo(schoolId: number | string, formData: FormData): Promise<any> {
    const res = await api.post(`/academic-admin/my-school/${schoolId}/identidad/upload-escudo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return res.data
  },

  async resetSchoolEscudo(schoolId: number | string, payload: any): Promise<any> {
    const res = await api.post(`/academic-admin/my-school/${schoolId}/identidad/reset`, payload)
    return res.data
  }
}

export default academicService
