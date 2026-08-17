import api from './api'

export const academicService = {
  // Periods
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

  async updatePeriod(id: number | string, payload: any): Promise<any> {
    const res = await api.put(`/periodos/${id}`, payload)
    return res.data
  },

  async deletePeriod(id: number | string): Promise<any> {
    const res = await api.delete(`/periodos/${id}`)
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

  // Subjects
  async getSubjects(schoolId: number | string, params?: any): Promise<any[]> {
    const res = await api.get(`/academic-admin/subjects/${schoolId}`, { params })
    return Array.isArray(res.data) ? res.data : []
  },

  async getTrashSubjects(schoolId: number | string): Promise<any[]> {
    const res = await api.get(`/academic-admin/subjects/trash/${schoolId}`)
    return Array.isArray(res.data) ? res.data : []
  },

  async createSubject(payload: any): Promise<any> {
    const res = await api.post('/academic-admin/subjects', payload)
    return res.data
  },

  async deleteSubject(id: number | string, schoolId: number | string, force = false): Promise<any> {
    const res = await api.delete(`/academic-admin/subjects/${id}`, {
      params: { schoolId, force: force ? 'true' : 'false' }
    })
    return res.data
  },

  async getSubjectDetails(id: number | string, schoolId: number | string, params?: any): Promise<any> {
    const res = await api.get(`/academic-admin/subjects/${id}/details/${schoolId}`, { params })
    return res.data
  },

  async getSubjectCurriculumDetails(id: number | string, schoolId: number | string, yearId?: number): Promise<any> {
    const params: any = { schoolId }
    if (yearId) params.yearId = yearId
    const res = await api.get(`/academic-admin/subjects/${id}/curriculum-details`, { params })
    return res.data
  },

  async saveCompetency(payload: any): Promise<any> {
    const res = await api.post('/academic-admin/settings/competencies', payload)
    return res.data
  },

  async deleteCompetency(id: number | string, schoolId: number | string): Promise<any> {
    const res = await api.delete(`/academic-admin/settings/competencies/${id}`, { params: { schoolId } })
    return res.data
  },

  async createCurriculumEvidence(competencyId: number | string, payload: any): Promise<any> {
    const res = await api.post(`/academic-admin/settings/competencies/${competencyId}/evidencias`, payload)
    return res.data
  },

  async updateCurriculumEvidence(id: number | string, payload: any): Promise<any> {
    const res = await api.put(`/academic-admin/settings/evidencias/${id}`, payload)
    return res.data
  },


  async deleteCurriculumEvidence(id: number | string, schoolId: number | string): Promise<any> {
    const res = await api.delete(`/academic-admin/settings/evidencias/${id}`, { params: { schoolId } })
    return res.data
  },

  // Settings

  async getSettings(schoolId: number | string, params?: any): Promise<any> {
    const res = await api.get(`/academic-admin/settings/${schoolId}`, { params })
    return res.data
  },

  async updateSettings(schoolId: number | string, payload: any): Promise<any> {
    const res = await api.put(`/academic-admin/settings/${schoolId}`, payload)
    return res.data
  }
}

export default academicService
