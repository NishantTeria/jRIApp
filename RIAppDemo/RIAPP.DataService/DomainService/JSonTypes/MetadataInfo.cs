using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Runtime.Serialization;
using System.ComponentModel;
using RIAPP.DataService.Resources;
using RIAPP.DataService;
using System.Security.Principal;
using System.Web.Script.Serialization;
using RIAPP.DataService.Utils;

namespace RIAPP.DataService
{
    [DataContract]
    public partial class MetadataInfo
    {
        private List<DbSetInfo> _dbSets = new List<DbSetInfo>();
        private List<Association> _associations = new List<Association>();
        private List<MethodDescription> _svcMethods = new List<MethodDescription>();
       
        public MetadataInfo()
        {
            this.serverTimezone = DataHelper.GetLocalDateTimezoneOffset(DateTime.Now);
        }

        [DataMember]
        public List<DbSetInfo> dbSets
        {
            get
            {
                return _dbSets;
            }
            set
            {
                this._dbSets = value;
            }
        }

        [DataMember]
        public List<Association> associations
        {
            get
            {
                return _associations;
            }
            set
            {
                this._associations = value;
            }
        }

        [DataMember]
        public List<MethodDescription> methods
        {
            get
            {
                return _svcMethods;
            }
            set
            {
                this._svcMethods = value;
            }
        }

        [DataMember]
        public int serverTimezone
        {
            get;
            set;
        }

        public string ToJSON() {
            return SerializationHelper.Serialize(this);
        }
    }
}
