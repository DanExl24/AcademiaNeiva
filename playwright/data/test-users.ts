/**
 * Credenciales y usuarios predeterminados para la suite E2E de AcademiaNeiva
 */

export const TEST_USERS = {
  adminGeneral: {
    email: 'admin.general@academianeiva.edu.co',
    password: 'adminGeneral123',
    name: 'Admin General',
    role: 'admin_general',
    dashboardUrl: '/admin-dashboard'
  },
  directivoRector: {
    email: 'rector@ceaschool.edu.co',
    password: 'directivo123',
    name: 'Rector CEA School',
    role: 'directivo',
    schoolId: 1,
    dashboardUrl: '/dashboard'
  },
  directivoCoordinador: {
    email: 'directivo@ceaschool.edu.co',
    password: 'directivo123',
    name: 'Directivo CEA School',
    role: 'directivo',
    schoolId: 1,
    dashboardUrl: '/dashboard'
  },
  docente: {
    email: 'matematicas.1@ceaschool.edu.co',
    password: 'docente123',
    name: 'Docente Matemáticas',
    role: 'docente',
    schoolId: 1,
    dashboardUrl: '/dashboard'
  },
  estudiante: {
    code: 'EST-1-1',
    document: '1005100001',
    email: 'est1.1@ceaschool.edu.co',
    password: 'estudiante123',
    role: 'estudiante',
    schoolId: 1,
    dashboardUrl: '/student/dashboard'
  },
  padre: {
    email: 'matematicas.1@ceaschool.edu.co',
    password: 'docente123', // En el seed el docente también posee el rol acudiente
    role: 'padre',
    schoolId: 1,
    dashboardUrl: '/dashboard'
  },
  invalidUser: {
    email: 'usuario.inexistente@noexiste.edu.co',
    password: 'PasswordIncorrecto999'
  }
};
