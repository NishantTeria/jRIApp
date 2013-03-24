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
    public class FieldRel
    {
        public FieldRel()
        {
        }
        [DataMember]
        public string parentField { get; set; }
        [DataMember]
        public string childField { get; set; }
    }

    [DataContract]
    public class Association
    {
        private List<FieldRel> _fieldRelations = new List<FieldRel>();

        public Association()
        { 
        }
        
        /// <summary>
        /// unique association name
        /// </summary>
        [DataMember]
        public string name { get; set; }

        [DataMember]
        public string parentDbSetName { get; set; }
        [DataMember]
        public string childDbSetName { get; set; }
        
        /// <summary>
        /// navigation property name from child entity to parent entity
        /// </summary>
        [DataMember]
        public string childToParentName { get; set; }

        /// <summary>
        /// navigation property name from parent entity to children entity
        /// </summary>
        [DataMember]
        public string parentToChildrenName { get; set; }

        [DataMember]
        public DeleteAction onDeleteAction { get; set; }

        [DataMember]
        public List<FieldRel> fieldRels
        {
            get
            {
                return _fieldRelations;
            }
            set
            {
                this._fieldRelations = value;
            }
        }
    }
}
