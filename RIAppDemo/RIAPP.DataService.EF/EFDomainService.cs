using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Principal;
using System.Reflection;
using System.Collections;
using System.Transactions;
using RIAPP.DataService.Utils;
using System.Data.Objects;

namespace RIAPP.DataService.EF
{
    public abstract class EFDomainService<TDB> : BaseDomainService
        where TDB : System.Data.Objects.ObjectContext
    {
        private TDB _db;
        private bool _ownsDb = false;
        
        public EFDomainService(TDB db, IPrincipal principal)
            :base(principal)
        {
            this._db = db;
        }

        public EFDomainService(IPrincipal principal)
            : this(null,principal)
        {
            
        }


        #region Overridable Methods
        protected virtual TDB CreateDataContext() {
            return Activator.CreateInstance<TDB>();
        }

        protected override void ExecuteChangeSet()
        {
            using (TransactionScope transScope = new TransactionScope(TransactionScopeOption.RequiresNew, 
                new TransactionOptions { IsolationLevel = IsolationLevel.ReadCommitted, Timeout = TimeSpan.FromMinutes(1.0) }))
            {
                this.DB.SaveChanges();
                
                transScope.Complete();
            }
        }

        #endregion

        protected TDB DB
        {
            get
            {
                if (this._db == null)
                {
                    this._db = this.CreateDataContext();
                    if (this._db != null)
                    {
                        this._ownsDb = true;
                    }
                }
                return this._db;
            }
        }

        protected override void Dispose(bool isDisposing)
        {
            if (this._db != null && this._ownsDb)
            {
                this._db.Dispose();
                this._db = null;
                this._ownsDb = false;
            }
        }
    }
}
