using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using RIAPP.DataService;
using RIAPP.DataService.Resources;

namespace RIAPP.DataService.Security
{
    public static class SecurityHelper
    {
        public const string AUTHENTICATED = "_mustbe_authenicated";
        public const string ALLOW_ANONYMOUS = "_allow_anonymous";

        public static MethodInfo GetMethodInfo(Type type, string name)
        {
            MethodInfo meth = null;
            if (!string.IsNullOrEmpty(name))
                meth = type.GetMethod(name);
            return meth;
        }
        public static IEnumerable<string> GetRolesForMethods(IEnumerable<MethodInfo> methods)
        {
            LinkedList<string> roles_list = new LinkedList<string>();
            foreach (MethodInfo methInfo in methods)
            {
                var attrs = methInfo.GetCustomAttributes(typeof(AuthorizeAttribute), false).OfType<AuthorizeAttribute>();
                if (attrs.Count() == 0)
                {
                    //allow unauthenticated access
                    var passthrough_attrs = methInfo.GetCustomAttributes(typeof(AllowAnonymousAttribute), false).OfType<AllowAnonymousAttribute>();
                    roles_list.AddLast(ALLOW_ANONYMOUS);
                }
                else
                {
                    //at least user must be authenticated
                    roles_list.AddLast(AUTHENTICATED);
                    foreach (var attr in attrs)
                    {
                        var attr_roles = attr.Roles.Select(a => a.Trim());
                        foreach (var role in attr_roles)
                            roles_list.AddLast(role);
                    }
                }
            }

            var distinct_roles = roles_list.Distinct();
            return distinct_roles;
        }
        public static IEnumerable<string> GetRolesForService(Type serviceType)
        {
            LinkedList<string> roles_list = new LinkedList<string>();
            var attrs = serviceType.GetCustomAttributes(typeof(AuthorizeAttribute), false).OfType<AuthorizeAttribute>();
            if (attrs.Count() > 0)
            {
                //at least user must be authenticated
                roles_list.AddLast(SecurityHelper.AUTHENTICATED);
            }

            foreach (var attr in attrs)
            {
                var attr_roles = attr.Roles.Select(a => a.Trim());
                foreach (var role in attr_roles)
                    roles_list.AddLast(role);
            }

            var distinct_roles = roles_list.Distinct();
            return distinct_roles;
        }
        public static MethodInfo GetCRUDMethodInfo(DbSetInfo dbInfo, RowInfo rowInfo)
        {
            MethodInfo methInfo = null;
            switch (rowInfo.changeType)
            {
                case ChangeType.Added:
                    methInfo = dbInfo.getOperationMethodInfo(OperationNames.CREATE);
                    break;
                case ChangeType.Deleted:
                    methInfo = dbInfo.getOperationMethodInfo(OperationNames.DELETE);
                    break;
                case ChangeType.Updated:
                    methInfo = dbInfo.getOperationMethodInfo(OperationNames.UPDATE);
                    break;
                default:
                    throw new DomainServiceException(string.Format(ErrorStrings.ERR_REC_CHANGETYPE_INVALID, dbInfo.EntityType.Name, rowInfo.changeType));
            }
            return methInfo;
        }
        public static bool CanAccessMethod(MethodInfo methInfo, IAuthorizer authorizer)
        {
            try
            {
                authorizer.CheckUserRightsToExecute(methInfo);
                return true;
            }
            catch(AccessDeniedException)
            {
                return false;
            }
        }

        public static DbSetPermit GetDbSetPermissions(DbSetInfo dbInfo, IAuthorizer authorizer)
        {
            MethodInfo methInfo = null;
            DbSetPermit permit = new DbSetPermit();

            methInfo = dbInfo.getOperationMethodInfo(OperationNames.CREATE);
            permit.canAddRow = methInfo != null && CanAccessMethod(methInfo,authorizer);

            methInfo = dbInfo.getOperationMethodInfo(OperationNames.UPDATE);
            permit.canEditRow = methInfo != null && CanAccessMethod(methInfo, authorizer);

            methInfo = dbInfo.getOperationMethodInfo(OperationNames.DELETE);
            permit.canDeleteRow = methInfo != null && CanAccessMethod(methInfo, authorizer);

            methInfo = dbInfo.getOperationMethodInfo(OperationNames.REFRESH);
            permit.canRefreshRow = methInfo != null && CanAccessMethod(methInfo, authorizer);
            return permit;
        }
    }
}
