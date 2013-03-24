using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Security.Principal;
using System.Reflection;
using RIAPP.DataService;
using RIAPP.DataService.Resources;


namespace RIAPP.DataService.Security
{
    public class Authorizer : IAuthorizer
    {
        private Type _serviceType = null;
        private IEnumerable<string> _serviceRoles = null;
        private IPrincipal _principal;

        public Authorizer(Type serviceType, IPrincipal principal)
        {
            this._serviceType = serviceType;
            if (principal == null)
            {
                IIdentity identity = new GenericIdentity(string.Empty);
                IPrincipal unauthentcated = new GenericPrincipal(identity, new string[0]);
                this._principal = unauthentcated;
            }
            else
                this._principal = principal;
        }


        private bool CheckAccessCore(IEnumerable<string> roles)
        {
            if (this.principal == null)
                return false;
            if (roles == null || !roles.Any())
                return true;
            if ((!this.principal.Identity.IsAuthenticated && roles.Contains(SecurityHelper.AUTHENTICATED, StringComparer.Ordinal)))
                return false;
            var filteredRoles = roles.Where(r => !r.Equals(SecurityHelper.AUTHENTICATED, StringComparison.Ordinal));
            if (!filteredRoles.Any())
                return true;
            foreach (string role in filteredRoles)
            {
                if (this.principal.IsInRole(role))
                {
                    return true;
                }
            }
            return false;
        }

        private bool CheckAccess(IEnumerable<string> requiredRoles)
        {
            bool allowAnonymous = requiredRoles.Any(r => r.Equals(SecurityHelper.ALLOW_ANONYMOUS, StringComparison.Ordinal));
            if (allowAnonymous)
                return true;
            if (this.principal == null)
                return false;
            var svc_roles = this.GetRolesForService();
            if (!this.CheckAccessCore(svc_roles))
                return false;
            var filteredRoles = requiredRoles.Where(r => !r.Equals(SecurityHelper.ALLOW_ANONYMOUS, StringComparison.Ordinal));
            return this.CheckAccessCore(filteredRoles);
        }

        private IEnumerable<string> GetRolesForService()
        {
            if (this._serviceRoles != null)
                return this._serviceRoles;
            this._serviceRoles = SecurityHelper.GetRolesForService(this._serviceType);
            return this._serviceRoles;
        }
     
        /// <summary>
        /// throws AccesDeniedExeption if user have no rights to execute operation
        /// </summary>
        /// <param name="changeSet"></param>
        public void CheckUserRightsToExecute(IEnumerable<MethodInfo> methods)
        {
            var roles = SecurityHelper.GetRolesForMethods(methods);

            if (!this.CheckAccess(roles))
            {
                string user = (this.principal == null || this.principal.Identity == null || !this.principal.Identity.IsAuthenticated) ? "Anonymous" : this.principal.Identity.Name;
                throw new AccessDeniedException(string.Format(ErrorStrings.ERR_USER_ACCESS_DENIED, user));
            }
        }

        /// <summary>
        /// throws AccesDeniedExeption if user have no rights to execute operation
        /// </summary>
        /// <param name="changeSet"></param>
        public void CheckUserRightsToExecute(MethodInfo method)
        {
            var roles = SecurityHelper.GetRolesForMethods(new MethodInfo[] { method });

            if (!CheckAccess(roles))
            {
                string user = (this.principal == null || this.principal.Identity == null || !this.principal.Identity.IsAuthenticated) ? "Anonymous" : this.principal.Identity.Name;
                throw new AccessDeniedException(string.Format(ErrorStrings.ERR_USER_ACCESS_DENIED,user));
            }
        }

        public IPrincipal principal
        {
            get
            {
                return this._principal;
            }
        }

        public Type serviceType
        {
            get
            {
                return this._serviceType;
            }
        }
    }
}
